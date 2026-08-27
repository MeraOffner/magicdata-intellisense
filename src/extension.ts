import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage('MagicData Extension Loaded Successfully!');

    let schema: {
        elements: { [key: string]: any },
        actions: { [key: string]: any },
        tagEnums: { [tagName: string]: { [attrName: string]: string[] } },
        enums: { [key: string]: string[] },
        expressions: string[]
    } = {
        elements: {},
        actions: {},
        tagEnums: {},
        enums: {},
        expressions: []
    };

    try {
        const xmlPath = path.join(context.extensionPath, 'MDLang.xml');
        if (fs.existsSync(xmlPath)) {
            const xmlData = fs.readFileSync(xmlPath, 'utf8');
            const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
            const jsonObj = parser.parse(xmlData);
            const root = jsonObj.MagicDataLanguage;

            // Parse AutoCompleteExpression
            const exprRows = root?.AutoCompleteExpression?.Row;
            if (Array.isArray(exprRows)) {
                exprRows.forEach((row: any) => {
                    const attr = row['@_MdLangAttr'];
                    if (attr && !schema.expressions.includes(attr)) {
                        schema.expressions.push(attr);
                    }
                });
            }

            // Parse Elements & Attributes
            const elementsList = root?.Element;
            if (Array.isArray(elementsList)) {
                elementsList.forEach((elem: any) => {
                    const key = elem['@_Key'];
                    const name = elem['@_Name'] || key;
                    const type = elem['@_Type'];
                    const hint = elem['@_Hint'] || '';

                    let attributes = elem.Attribute;
                    if (attributes && !Array.isArray(attributes)) {
                        attributes = [attributes];
                    }

                    const requiredAttributes: string[] = [];
                    const optionalAttributes: string[] = [];

                    if (attributes) {
                        attributes.forEach((attr: any) => {
                            const attrName = attr['@_Name'];
                            const isReq = attr['@_Required'] === 'True' || attr['@_Required'] === 'true';

                            if (attrName) {
                                if (isReq) {
                                    requiredAttributes.push(attrName);
                                } else {
                                    optionalAttributes.push(attrName);
                                }
                            }

                            if (attr.Enum && attrName) {
                                const enumList = Array.isArray(attr.Enum) ? attr.Enum : [attr.Enum];
                                const cleanedEnums = enumList
                                    .map((v: any) => String(v).trim())
                                    .filter((v: string) => v !== '');

                                if (cleanedEnums.length > 0) {
                                    if (name) {
                                        if (!schema.tagEnums[name]) {
                                            schema.tagEnums[name] = {};
                                        }
                                        const existing = schema.tagEnums[name][attrName] || [];
                                        schema.tagEnums[name][attrName] = [...new Set([...existing, ...cleanedEnums])];
                                    }
                                    schema.enums[attrName] = [...new Set([...(schema.enums[attrName] || []), ...cleanedEnums])];
                                }
                            }
                        });
                    }

                    // Register action metadata strictly to schema.actions if Type="Action"
                    if (type === 'Action' && key && key.toUpperCase() !== 'ACTION') {
                        schema.actions[key] = {
                            hint: hint || `MagicData Action: ${key}`,
                            requiredAttributes: requiredAttributes,
                            optionalAttributes: optionalAttributes
                        };
                    } else if (name && !schema.elements[name]) {
                        // Register structural XML tags only
                        schema.elements[name] = {
                            hint: hint,
                            isSelfClosing: name === 'ACTION' || name === 'Field' || name === 'LogParameters',
                            requiredAttributes: requiredAttributes,
                            optionalAttributes: optionalAttributes
                        };
                    }

                    // Collect action names from ACTION element enums
                    if (name === 'ACTION' && attributes) {
                        attributes.forEach((attr: any) => {
                            if (attr['@_Name'] === 'Name' && attr.Enum) {
                                const enumValues = Array.isArray(attr.Enum) ? attr.Enum : [attr.Enum];
                                enumValues.forEach((actName: string) => {
                                    if (actName && actName.toUpperCase() !== 'ACTION') {
                                        if (!schema.actions[actName]) {
                                            schema.actions[actName] = {
                                                hint: `MagicData Action: ${actName}`,
                                                requiredAttributes: [],
                                                optionalAttributes: []
                                            };
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
            }

            // Register Core Elements
            const mdElements = root?.MDElements?.Row;
            if (Array.isArray(mdElements)) {
                mdElements.forEach((row: any) => {
                    const tag = row['@_Name'];
                    if (tag) {
                        const tagName = tag.toLowerCase() === 'action' ? 'ACTION' : tag;
                        const existingKey = Object.keys(schema.elements).find(k => k.toLowerCase() === tagName.toLowerCase());
                        
                        if (!existingKey) {
                            schema.elements[tagName] = {
                                hint: `MagicData Element: ${tagName}`,
                                isSelfClosing: tagName === 'ACTION' || tagName === 'Field' || tagName === 'LogParameters',
                                requiredAttributes: ['Name'],
                                optionalAttributes: []
                            };
                        }
                    }
                });
            }

            // Guarantee ACTION tag exists
            schema.elements['ACTION'] = {
                hint: 'Executes a single action or command',
                isSelfClosing: true,
                requiredAttributes: ['Name'],
                optionalAttributes: ['Alias', 'Value', 'Field', 'Rule', 'Expression']
            };

        }
    } catch (err) {
        console.error('MagicData Extension: Failed to parse MDLang.xml', err);
    }

    function buildAttributeSnippet(attr: string, index: number): string {
        return `${attr}="$${index}"`;
    }

    // Completion Provider
    const completionProvider = vscode.languages.registerCompletionItemProvider(
        ['xml', 'magicdata', 'plaintext'],
        {
            provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
                const completionItems: vscode.CompletionItem[] = [];
                const linePrefix = document.lineAt(position).text.substring(0, position.character);

                // Tag completion (<)
                const tagMatch = linePrefix.match(/<([A-Za-z0-9_-]*)$/);
                if (tagMatch) {
                    if (schema.elements) {
                        Object.keys(schema.elements).forEach(tagName => {
                            const item = new vscode.CompletionItem(tagName, vscode.CompletionItemKind.Class);
                            const element = schema.elements[tagName] || {};

                            if (element.hint) {
                                item.documentation = new vscode.MarkdownString(element.hint);
                            }

                            const reqAttrs = element.requiredAttributes || [];
                            let reqAttrsSnippet = '';
                            if (reqAttrs.length > 0) {
                                reqAttrsSnippet = ' ' + reqAttrs
                                    .map((attr: string, idx: number) => buildAttributeSnippet(attr, idx + 1))
                                    .join(' ');
                            }

                            if (element.isSelfClosing) {
                                item.insertText = new vscode.SnippetString(`${tagName}${reqAttrsSnippet} />`);
                            } else {
                                const lastIndex = reqAttrs.length + 1;
                                item.insertText = new vscode.SnippetString(
                                    `${tagName}${reqAttrsSnippet}>\n\t$${lastIndex}\n</${tagName}>`
                                );
                            }

                            completionItems.push(item);
                        });
                    }
                    return completionItems;
                }

                // Attribute completion inside a tag
                const openTagMatch = linePrefix.match(/<([A-Za-z0-9_-]+)(?:\s+[\w-]+=*(?:"[^"]*"|'[^']*')?)*\s+([\w-]*)$/);
                if (openTagMatch) {
                    const tagName = openTagMatch[1];
                    const element = schema.elements?.[tagName];

                    let allAttrs: string[] = [];

                    if (element) {
                        const req = element.requiredAttributes || [];
                        const opt = element.optionalAttributes || [];
                        allAttrs = [...req, ...opt];
                    }

                    if (tagName.toUpperCase() === 'ACTION') {
                        allAttrs.push('Expression', 'Rule', 'Alias', 'Name', 'Value', 'Field');
                    }

                    allAttrs = [...new Set(allAttrs)];

                    allAttrs.forEach((attr: string) => {
                        const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
                        item.insertText = new vscode.SnippetString(buildAttributeSnippet(attr, 1));
                        completionItems.push(item);
                    });

                    return completionItems;
                }

                // Values inside quotes
                const lastAttrRegex = /([A-Za-z0-9_-]+)=["']([^"']*)$/;
                const attrMatch = linePrefix.match(lastAttrRegex);

                if (attrMatch) {
                    const attrName = attrMatch[1];
                    const currentTagMatch = linePrefix.match(/<([A-Za-z0-9_-]+)\b[^>]*$/);
                    const tagName = currentTagMatch ? currentTagMatch[1] : '';

                    // Special predefined options for Len attribute
                    if (attrName === 'Len') {
                        const commonLengths = ['10', '20', '30', '50', '100', '255'];
                        commonLengths.forEach(lenVal => {
                            completionItems.push(new vscode.CompletionItem(lenVal, vscode.CompletionItemKind.Value));
                        });
                        return completionItems;
                    }

                    // Special logic for action names strictly inside <ACTION Name="...">
                    if (tagName.toLowerCase() === 'action' && attrName === 'Name' && schema.actions) {
                        Object.keys(schema.actions).forEach((actionName) => {
                            const actionDef = schema.actions[actionName];
                            const item = new vscode.CompletionItem(actionName, vscode.CompletionItemKind.Value);

                            if (actionDef.hint) {
                                item.documentation = new vscode.MarkdownString(actionDef.hint);
                            }

                            const reqAttrs = actionDef.requiredAttributes || [];
                            const otherAttrsSnippet = reqAttrs
                                .filter((a: string) => a !== 'Name')
                                .map((a: string, idx: number) => buildAttributeSnippet(a, idx + 1))
                                .join(' ');

                            const snippetSuffix = otherAttrsSnippet ? ` ${otherAttrsSnippet}` : '';

                            item.insertText = new vscode.SnippetString(`${actionName}${snippetSuffix}`);

                            completionItems.push(item);
                        });
                        return completionItems;
                    }

                    // Special logic for expressions or functions inside Rule or Expression attributes
                    if ((attrName === 'Expression' || attrName === 'Rule' || attrName === 'Experssion') && schema.expressions) {
                        schema.expressions.forEach((expr) => {
                            const item = new vscode.CompletionItem(expr, vscode.CompletionItemKind.Function);
                            item.insertText = expr;
                            completionItems.push(item);
                        });
                        return completionItems;
                    }

                    // Generic lookup: check tag-specific enums first, then global enums
                    const matchedTagKey = Object.keys(schema.tagEnums).find(
                        k => k.trim().toLowerCase() === tagName.trim().toLowerCase()
                    );

                    const tagSpecificEnums = matchedTagKey ? schema.tagEnums[matchedTagKey]?.[attrName] : undefined;
                    const globalEnums = schema.enums?.[attrName];
                    const availableValues = tagSpecificEnums || globalEnums;

                    // If enums exist for this attribute, offer them
                    if (availableValues && availableValues.length > 0) {
                        availableValues.forEach((val: string) => {
                            completionItems.push(new vscode.CompletionItem(val, vscode.CompletionItemKind.Value));
                        });
                        return completionItems;
                    }

                    // Generic fallback: suppress word completion for free-text attributes
                    const dummyItem = new vscode.CompletionItem('', vscode.CompletionItemKind.Text);
                    dummyItem.insertText = '';
                    return new vscode.CompletionList([dummyItem], true);
                }

                return completionItems;
            }
        },
        '<', ' ', '=', '"', "'", '+', '-', '*', '/', '('
    );

    // Command for creating a new project
    const createProjectCmd = vscode.commands.registerCommand('magicdata.createProject', async () => {
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select a folder for the new MagicData project'
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const projectPath = folderUri[0].fsPath;

        try {
            const subFolders = ['Input', 'InputDef', 'Output', 'OutputDef', 'Lookup', 'LookupDef', 'Log'];
            for (const folder of subFolders) {
                const dirPath = path.join(projectPath, folder);
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
            }

            const workfieldsPath = path.join(projectPath, 'LookupDef', 'WorkFields.xml');
            if (!fs.existsSync(workfieldsPath)) {
                const initialWorkfieldsContent = `<?xml version="1.0" encoding="UTF-8"?>\n<WORKFIELDS Name="workfields">\n\t<Field Name="v_Status" Type="String" Len="10" />\n</WORKFIELDS>`;
                fs.writeFileSync(workfieldsPath, initialWorkfieldsContent, { encoding: 'utf8', flag: 'w' });
            }

            const jtmPath = path.join(projectPath, 'main.jtm');
            const initialJtmContent = `<?xml version="1.0" encoding="UTF-8"?>\n<Job Name="NewProject" Company="MyCompany" ProjectVersion="1.0.0" Category="APPLICATION" BasePath="${projectPath}">\n\t<WORKFIELDS Name="WorkFields" FileName="WorkFields.xml" />\n\t<Task Name="MainTask">\n\t\t\n\t</Task>\n</Job>`;
            fs.writeFileSync(jtmPath, initialJtmContent, { encoding: 'utf8', flag: 'w' });

            const doc = await vscode.workspace.openTextDocument(jtmPath);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage('MagicData project created successfully!');
        } catch (err: any) {
            vscode.window.showErrorMessage(`Error creating project: ${err.message}`);
        }
    });

    context.subscriptions.push(completionProvider, createProjectCmd);
}

export function deactivate() {}