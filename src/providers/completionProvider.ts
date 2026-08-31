import * as vscode from 'vscode';
import { Schema } from '../services/schemaParser';
import { EXTENSION_CONSTANTS } from '../constants';

export function createCompletionProvider(schema: Schema): vscode.Disposable {
    const actionTag = EXTENSION_CONSTANTS.MAGIC_DATA.ACTION_TAG;

    function buildAttributeSnippet(attr: string, index: number): string {
        return `${attr}="$${index}"`;
    }

    return vscode.languages.registerCompletionItemProvider(
        ['xml', 'magicdata', 'plaintext'],
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const completionItems: vscode.CompletionItem[] = [];
                const linePrefix = document.lineAt(position).text.substring(0, position.character);

                // 1. Tag completion (<)
                const tagMatch = linePrefix.match(/<([A-Za-z0-9_-]*)$/);
                if (tagMatch) {
                    if (schema.elements) {
                        Object.values(schema.elements).forEach(element => {
                            const item = new vscode.CompletionItem(element.name, vscode.CompletionItemKind.Class);

                            if (element.hint) {
                                item.documentation = new vscode.MarkdownString(element.hint);
                            }

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
                                item.insertText = new vscode.SnippetString(`${element.name}${reqAttrsSnippet} />`);
                            } else {
                                const lastIndex = reqAttrs.length + 1;
                                item.insertText = new vscode.SnippetString(
                                    `${element.name}${reqAttrsSnippet}>\n\t$${lastIndex}\n</${element.name}>`
                                );
                            }

                            completionItems.push(item);
                        });
                    }
                    return completionItems;
                }

               // 2. Attribute completion inside a tag
                const openTagMatch = linePrefix.match(/<([A-Za-z0-9_-]+)(?:\s+[\w-]+=*(?:"[^"]*"|'[^']*')?)*\s+([\w-]*)$/);
                if (openTagMatch) {
                    const tagName = openTagMatch[1];
                    let element = schema.elements?.[tagName];

                    // Context-aware logic for <ACTION Name="...">
                    if (tagName.toLowerCase() === actionTag.toLowerCase()) {
                        const fullLineText = document.lineAt(position.line).text;
                        const actionNameMatch = fullLineText.match(/Name=["']([^"']+)["']/i);

                        if (actionNameMatch && actionNameMatch[1]) {
                            const specificActionName = actionNameMatch[1];
                            const specificActionDef = schema.actions[specificActionName];

                            if (specificActionDef && Object.keys(specificActionDef.attributes).length > 0) {
                                element = specificActionDef;
                            }
                        }
                    }

                    if (element && element.attributes) {
                        // Filter out attributes that are already written on the current line
                        const fullLineText = document.lineAt(position.line).text;

                        Object.values(element.attributes).forEach(attrDef => {
                            const attrRegex = new RegExp(`\\b${attrDef.name}=`, 'i');
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
                const lastAttrRegex = /([A-Za-z0-9_-]+)=["']([^"']*)$/;
                const attrMatch = linePrefix.match(lastAttrRegex);

                if (attrMatch) {
                    const attrName = attrMatch[1];
                    const currentTagMatch = linePrefix.match(/<([A-Za-z0-9_-]+)\b[^>]*$/);
                    const tagName = currentTagMatch ? currentTagMatch[1] : '';

                    // Special predefined options for Len attribute
                    if (attrName === 'Len') {
                        ['10', '20', '30', '50', '100', '255'].forEach(lenVal => {
                            completionItems.push(new vscode.CompletionItem(lenVal, vscode.CompletionItemKind.Value));
                        });
                        return completionItems;
                    }

                    // Action Name completions
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
                                item.insertText = new vscode.SnippetString(`${actionDef.name}"${snippetSuffix}`);
                            } else {
                                item.insertText = new vscode.SnippetString(`${actionDef.name}${snippetSuffix}`);
                            }

                            completionItems.push(item);
                        });
                        return completionItems;
                    }

                    // Rule / Expression completions
                    if ((attrName === 'Expression' || attrName === 'Rule') && schema.expressions) {
                        schema.expressions.forEach((expr) => {
                            const item = new vscode.CompletionItem(expr, vscode.CompletionItemKind.Function);
                            item.insertText = expr;
                            completionItems.push(item);
                        });
                        return completionItems;
                    }

                    // Direct Enum lookup for this specific Tag & Attribute
                    const element = schema.elements?.[tagName];
                    const attrDef = element?.attributes?.[attrName];

                    if (attrDef && attrDef.allowedValues.length > 0) {
                        attrDef.allowedValues.forEach(val => {
                            completionItems.push(new vscode.CompletionItem(val, vscode.CompletionItemKind.Value));
                        });
                        return completionItems;
                    }

                    // Fallback
                    const dummyItem = new vscode.CompletionItem('', vscode.CompletionItemKind.Text);
                    dummyItem.insertText = '';
                    return new vscode.CompletionList([dummyItem], true);
                }

                return completionItems;
            }
        },
        '<', ' ', '=', '"', "'", '+', '-', '*', '/', '('
    );
}