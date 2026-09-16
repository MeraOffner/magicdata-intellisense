import * as vscode from 'vscode';
import { Schema } from '../services/schemaParser';
import { EXTENSION_CONSTANTS } from '../constants';

export function createCompletionProvider(schema: Schema): vscode.Disposable {
    const actionTag = EXTENSION_CONSTANTS.MAGIC_DATA.ACTION_TAG;
    const snippets = EXTENSION_CONSTANTS.SNIPPETS;
    const regex = EXTENSION_CONSTANTS.REGEX;

    function buildAttributeSnippet(attr: string, index: number): string {
        return snippets.ATTRIBUTE(attr, index);
    }

    return vscode.languages.registerCompletionItemProvider(
        ['xml', 'magicdata', 'plaintext'],
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const completionItems: vscode.CompletionItem[] = [];
                const linePrefix = document.lineAt(position).text.substring(0, position.character);

                // 1. Tag completion (<)
                const tagMatch = linePrefix.match(regex.TAG_COMPLETION);
                if (tagMatch) {
                    if (schema.elements) {
                        Object.values(schema.elements).forEach(element => {
                            const item = new vscode.CompletionItem(element.name, vscode.CompletionItemKind.Class);

                            if (element.hint) {
                                item.documentation = new vscode.MarkdownString(element.hint);
                            }

                            // Dynamic snippet insertion for <Resource> tag (Name first, then Type)
                            if (element.name.toLowerCase() === 'resource') {
                                item.insertText = new vscode.SnippetString('Resource Name="$1" Type="$2" />');
                                item.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger suggestions' };
                            } else {
                                const reqAttrs = Object.values(element.attributes)
                                    .filter(a => a.isRequired)
                                    .map(a => a.name);

                                let reqAttrsSnippet = '';
                                if (reqAttrs.length > 0) {
                                    reqAttrsSnippet = ' ' + reqAttrs
                                        .map((attr: string, idx: number) => buildAttributeSnippet(attr, idx + 1))
                                        .join(' ');
                                }

                                if (element.isSelfClosing) {
                                    item.insertText = new vscode.SnippetString(
                                        snippets.SELF_CLOSING_TAG(element.name, reqAttrsSnippet)
                                    );
                                } else {
                                    const lastIndex = reqAttrs.length + 1;
                                    item.insertText = new vscode.SnippetString(
                                        snippets.OPEN_CLOSE_TAG(element.name, reqAttrsSnippet, lastIndex)
                                    );
                                }
                            }

                            completionItems.push(item);
                        });
                    }
                    return completionItems;
                }

                // 2. Attribute completion inside a tag
                const openTagMatch = linePrefix.match(regex.OPEN_TAG_ATTRIBUTES);
                if (openTagMatch) {
                    const tagName = openTagMatch[1];
                    let element = schema.elements?.[tagName];

                    // Context-aware logic for <ACTION Name="...">
                    if (tagName.toLowerCase() === actionTag.toLowerCase()) {
                        const fullLineText = document.lineAt(position.line).text;
                        const actionNameMatch = fullLineText.match(regex.ACTION_NAME_ATTRIBUTE);

                        if (actionNameMatch && actionNameMatch[1]) {
                            const specificActionName = actionNameMatch[1];
                            const specificActionDef = schema.actions[specificActionName];

                            if (specificActionDef && Object.keys(specificActionDef.attributes).length > 0) {
                                element = specificActionDef;
                            }
                        }
                    }

                    // Context-aware logic for <Resource Type="...">
                    if (tagName.toLowerCase() === 'resource') {
                        const fullLineText = document.lineAt(position.line).text;
                        const resourceTypeMatch = fullLineText.match(/\bType=["']([^"']+)["']/i);

                        if (resourceTypeMatch && resourceTypeMatch[1]) {
                            const specificResourceType = resourceTypeMatch[1].toUpperCase();
                            const specificResourceDef = schema.resources?.[specificResourceType];

                            if (specificResourceDef && Object.keys(specificResourceDef.attributes).length > 0) {
                                element = specificResourceDef;
                            }
                        }
                    }

                    if (element && element.attributes) {
                        const fullLineText = document.lineAt(position.line).text;

                        Object.values(element.attributes).forEach(attrDef => {
                            const attrRegex = regex.ATTRIBUTE_EXISTS(attrDef.name);
                            if (!attrRegex.test(fullLineText)) {
                                const item = new vscode.CompletionItem(attrDef.name, vscode.CompletionItemKind.Property);
                                item.insertText = new vscode.SnippetString(buildAttributeSnippet(attrDef.name, 1));
                                completionItems.push(item);
                            }
                        });
                    }

                    return completionItems;
                }

                // 3. Values inside quotes
                const attrMatch = linePrefix.match(regex.LAST_ATTRIBUTE_VALUE);

                if (attrMatch) {
                    const attrName = attrMatch[1];
                    const currentTagMatch = linePrefix.match(regex.CURRENT_TAG_NAME);
                    const tagName = currentTagMatch ? currentTagMatch[1] : '';

                    // Resource Type completions dynamically loaded from parsed Schema
                    if (tagName.toLowerCase() === 'resource' && attrName === 'Type' && schema.resources) {
                        const fullLineText = document.lineAt(position.line).text;

                        Object.values(schema.resources).forEach((resourceDef) => {
                            const item = new vscode.CompletionItem(resourceDef.name, vscode.CompletionItemKind.Value);

                            if (resourceDef.hint) {
                                item.documentation = new vscode.MarkdownString(resourceDef.hint);
                            }

                            // Dynamically collect required attributes for this resource type, excluding 'name' and 'type' or existing attributes
                            const reqAttrs = Object.values(resourceDef.attributes).filter(
                                a => a.isRequired && 
                                     a.name.toLowerCase() !== 'type' && 
                                     a.name.toLowerCase() !== 'name' &&
                                     !regex.ATTRIBUTE_EXISTS(a.name).test(fullLineText)
                            );

                            const otherAttrsSnippet = reqAttrs
                                .map((a, idx) => buildAttributeSnippet(a.name, idx + 1))
                                .join(' ');

                            const snippetSuffix = otherAttrsSnippet ? ` ${otherAttrsSnippet}` : '';

                            const lineText = document.lineAt(position.line).text;
                            const charAfterCursor = lineText.charAt(position.character);

                            // Append missing required attributes outside quotes
                            if (charAfterCursor === '"' || charAfterCursor === "'") {
                                item.range = new vscode.Range(position, position.translate(0, 1));
                                item.insertText = new vscode.SnippetString(`${resourceDef.name}"${snippetSuffix}`);
                            } else {
                                item.insertText = new vscode.SnippetString(`${resourceDef.name}${snippetSuffix}`);
                            }

                            completionItems.push(item);
                        });
                        return completionItems;
                    }

                    // Action Name completions dynamically loaded from parsed Schema
                    if (tagName.toLowerCase() === actionTag.toLowerCase() && attrName === 'Name' && schema.actions) {
                        Object.values(schema.actions).forEach((actionDef) => {
                            const item = new vscode.CompletionItem(actionDef.name, vscode.CompletionItemKind.Value);

                            if (actionDef.hint) {
                                item.documentation = new vscode.MarkdownString(actionDef.hint);
                            }

                            const reqAttrs = Object.values(actionDef.attributes).filter(a => a.isRequired && a.name !== 'Name');
                            const otherAttrsSnippet = reqAttrs
                                .map((a, idx) => buildAttributeSnippet(a.name, idx + 1))
                                .join(' ');

                            const snippetSuffix = otherAttrsSnippet ? ` ${otherAttrsSnippet}` : '';

                            const lineText = document.lineAt(position.line).text;
                            const charAfterCursor = lineText.charAt(position.character);

                            if (charAfterCursor === '"' || charAfterCursor === "'") {
                                item.range = new vscode.Range(position, position.translate(0, 1));
                                item.insertText = new vscode.SnippetString(
                                    snippets.ACTION_WITH_SUFFIX_AND_QUOTE(actionDef.name, snippetSuffix)
                                );
                            } else {
                                item.insertText = new vscode.SnippetString(
                                    snippets.ACTION_WITH_SUFFIX(actionDef.name, snippetSuffix)
                                );
                            }

                            completionItems.push(item);
                        });
                        return completionItems;
                    }

                    // Get current element, sub-action, or sub-resource definition from XML Schema
                    let element = schema.elements?.[tagName];

                    if (tagName.toLowerCase() === actionTag.toLowerCase()) {
                        const fullLineText = document.lineAt(position.line).text;
                        const actionNameMatch = fullLineText.match(regex.ACTION_NAME_ATTRIBUTE);

                        if (actionNameMatch && actionNameMatch[1]) {
                            const specificActionName = actionNameMatch[1];
                            const specificActionDef = schema.actions?.[specificActionName];

                            if (specificActionDef) {
                                element = specificActionDef;
                            }
                        }
                    } else if (tagName.toLowerCase() === 'resource') {
                        const fullLineText = document.lineAt(position.line).text;
                        const resourceTypeMatch = fullLineText.match(/\bType=["']([^"']+)["']/i);

                        if (resourceTypeMatch && resourceTypeMatch[1]) {
                            const specificResourceType = resourceTypeMatch[1].toUpperCase();
                            const specificResourceDef = schema.resources?.[specificResourceType];

                            if (specificResourceDef) {
                                element = specificResourceDef;
                            }
                        }
                    }

                    const attrDef = element?.attributes?.[attrName];

                    // 1. Direct Enum lookup derived directly from XML Schema
                    if (attrDef && attrDef.allowedValues.length > 0) {
                        attrDef.allowedValues.forEach(val => {
                            completionItems.push(new vscode.CompletionItem(val, vscode.CompletionItemKind.Value));
                        });
                        return completionItems;
                    }

                    // 2. Number type from XML -> Offer predefined numbers from constants
                    if (attrDef?.aType === 'Number') {
                        EXTENSION_CONSTANTS.MAGIC_DATA.LEN_OPTIONS.forEach(numVal => {
                            completionItems.push(new vscode.CompletionItem(numVal, vscode.CompletionItemKind.Value));
                        });
                        return completionItems;
                    }

                    // 3. Rule / Expression type from XML -> Offer logical expressions
                    if ((attrDef?.aType === 'Rule' || attrDef?.aType === 'Expression') && schema.expressions) {
                        schema.expressions.forEach((expr) => {
                            const item = new vscode.CompletionItem(expr, vscode.CompletionItemKind.Function);
                            item.insertText = expr;
                            completionItems.push(item);
                        });
                        return completionItems;
                    }

                    // Strict Fallback: Suppress VS Code's word-based suggestions inside regular text attributes
                    const dummyItem = new vscode.CompletionItem('', vscode.CompletionItemKind.Text);
                    dummyItem.insertText = '';
                    dummyItem.range = new vscode.Range(position, position);
                    return new vscode.CompletionList([dummyItem], false);
                }

                return completionItems;
            }
        },
        ...Array.from(EXTENSION_CONSTANTS.MAGIC_DATA.TRIGGER_CHARACTERS)
    );
}