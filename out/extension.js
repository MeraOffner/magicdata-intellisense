"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const fast_xml_parser_1 = require("fast-xml-parser");
function activate(context) {
    vscode.window.showInformationMessage('MagicData Extension Loaded Successfully!');
    let schema = {
        elements: {},
        actions: {},
        enums: {},
        expressions: []
    };
    try {
        const xmlPath = path.join(context.extensionPath, 'MDLang.xml');
        if (fs.existsSync(xmlPath)) {
            const xmlData = fs.readFileSync(xmlPath, 'utf8');
            const parser = new fast_xml_parser_1.XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
            const jsonObj = parser.parse(xmlData);
            const root = jsonObj.MagicDataLanguage;
            // 1. Parse AutoCompleteExpression
            const exprRows = root?.AutoCompleteExpression?.Row;
            if (Array.isArray(exprRows)) {
                exprRows.forEach((row) => {
                    const attr = row['@_MdLangAttr'];
                    if (attr && !schema.expressions.includes(attr)) {
                        schema.expressions.push(attr);
                    }
                });
            }
            // 2. Parse Elements & Attributes
            const elementsList = root?.Element;
            if (Array.isArray(elementsList)) {
                elementsList.forEach((elem) => {
                    const key = elem['@_Key'];
                    const name = elem['@_Name'] || key;
                    const type = elem['@_Type'];
                    const hint = elem['@_Hint'] || '';
                    let attributes = elem.Attribute;
                    if (attributes && !Array.isArray(attributes)) {
                        attributes = [attributes];
                    }
                    const requiredAttributes = [];
                    const optionalAttributes = [];
                    if (attributes) {
                        attributes.forEach((attr) => {
                            const attrName = attr['@_Name'];
                            const isReq = attr['@_Required'] === 'True' || attr['@_Required'] === 'true';
                            if (attrName) {
                                if (isReq) {
                                    requiredAttributes.push(attrName);
                                }
                                else {
                                    optionalAttributes.push(attrName);
                                }
                            }
                            if (attr.Enum && attrName) {
                                const enumList = Array.isArray(attr.Enum) ? attr.Enum : [attr.Enum];
                                const cleanedEnums = enumList.filter((v) => v !== undefined && String(v).trim() !== '');
                                if (cleanedEnums.length > 0) {
                                    schema.enums[attrName] = [...new Set([...(schema.enums[attrName] || []), ...cleanedEnums])];
                                }
                            }
                        });
                    }
                    if (type === 'Action' && key) {
                        schema.actions[key] = {
                            hint: hint,
                            requiredAttributes: requiredAttributes,
                            optionalAttributes: optionalAttributes
                        };
                    }
                    else if (name && !schema.elements[name]) {
                        schema.elements[name] = {
                            hint: hint,
                            isSelfClosing: name === 'ACTION' || name === 'Field' || name === 'LogParameters',
                            requiredAttributes: requiredAttributes,
                            optionalAttributes: optionalAttributes
                        };
                    }
                    if (name === 'ACTION' && attributes) {
                        attributes.forEach((attr) => {
                            if (attr['@_Name'] === 'Name' && attr.Enum) {
                                const enumValues = Array.isArray(attr.Enum) ? attr.Enum : [attr.Enum];
                                enumValues.forEach((actName) => {
                                    if (actName && !schema.actions[actName]) {
                                        schema.actions[actName] = {
                                            hint: `MagicData Action: ${actName}`,
                                            requiredAttributes: []
                                        };
                                    }
                                });
                            }
                        });
                    }
                });
            }
            // 3. Register Core Elements
            const mdElements = root?.MDElements?.Row;
            if (Array.isArray(mdElements)) {
                mdElements.forEach((row) => {
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
            // Explicitly guarantee ACTION tag exists
            schema.elements['ACTION'] = {
                hint: 'Executes a single action or command',
                isSelfClosing: true,
                requiredAttributes: ['Name'],
                optionalAttributes: ['Alias', 'Value', 'Field', 'Rule', 'Expression']
            };
        }
    }
    catch (err) {
        console.error('MagicData Extension: Failed to parse MDLang.xml', err);
    }
    function buildAttributeSnippet(attr, index) {
        const enumValues = schema.enums?.[attr];
        if (enumValues && enumValues.length > 0) {
            return `${attr}="\${${index}|${enumValues.join(',')}|}"`;
        }
        return `${attr}="$${index}"`;
    }
    // ---- Completion Provider ----
    const completionProvider = vscode.languages.registerCompletionItemProvider(['xml', 'magicdata', 'plaintext'], {
        provideCompletionItems(document, position) {
            const completionItems = [];
            const linePrefix = document.lineAt(position).text.substring(0, position.character);
            // 1. Tag completion (<)
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
                                .map((attr, idx) => buildAttributeSnippet(attr, idx + 1))
                                .join(' ');
                        }
                        if (element.isSelfClosing) {
                            item.insertText = new vscode.SnippetString(`${tagName}${reqAttrsSnippet} />`);
                        }
                        else {
                            const lastIndex = reqAttrs.length + 1;
                            item.insertText = new vscode.SnippetString(`${tagName}${reqAttrsSnippet}>\n\t$${lastIndex}\n</${tagName}>`);
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
                const element = schema.elements?.[tagName];
                let allAttrs = [];
                if (element) {
                    const req = element.requiredAttributes || [];
                    const opt = element.optionalAttributes || [];
                    allAttrs = [...req, ...opt];
                }
                if (tagName.toUpperCase() === 'ACTION') {
                    allAttrs.push('Expression', 'Rule', 'Alias', 'Name', 'Value', 'Field');
                }
                allAttrs = [...new Set(allAttrs)];
                allAttrs.forEach((attr) => {
                    const item = new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property);
                    item.insertText = new vscode.SnippetString(buildAttributeSnippet(attr, 1));
                    completionItems.push(item);
                });
                return completionItems;
            }
            // 3. Values inside quotes
            const lastAttrRegex = /([A-Za-z0-9_-]+)=["']([^"']*)$/;
            const attrMatch = linePrefix.match(lastAttrRegex);
            if (attrMatch) {
                const attrName = attrMatch[1];
                const currentTagMatch = linePrefix.match(/<([A-Za-z0-9_-]+)\b[^>]*$/);
                const tagName = currentTagMatch ? currentTagMatch[1] : '';
                // Offer action names STRICTLY inside <ACTION Name="...">
                if (tagName.toLowerCase() === 'action' && attrName === 'Name' && schema.actions) {
                    Object.keys(schema.actions).forEach((actionName) => {
                        const actionDef = schema.actions[actionName];
                        const item = new vscode.CompletionItem(actionName, vscode.CompletionItemKind.Value);
                        if (actionDef.hint) {
                            item.documentation = new vscode.MarkdownString(actionDef.hint);
                        }
                        const reqAttrs = actionDef.requiredAttributes || [];
                        const otherAttrsSnippet = reqAttrs
                            .filter((a) => a !== 'Name')
                            .map((a, idx) => buildAttributeSnippet(a, idx + 1))
                            .join(' ');
                        const snippetSuffix = otherAttrsSnippet ? ` ${otherAttrsSnippet}` : '';
                        item.insertText = new vscode.SnippetString(`${actionName}"${snippetSuffix}`);
                        completionItems.push(item);
                    });
                    return completionItems;
                }
                // Offer expressions/functions inside Rule or Expression attributes
                if ((attrName === 'Expression' || attrName === 'Rule' || attrName === 'Experssion') && schema.expressions) {
                    schema.expressions.forEach((expr) => {
                        const item = new vscode.CompletionItem(expr, vscode.CompletionItemKind.Function);
                        item.insertText = expr;
                        completionItems.push(item);
                    });
                }
                // Offer predefined Enums BUT skip free-text Name attributes in structural tags
                const enumValues = schema.enums?.[attrName];
                if (enumValues) {
                    if (attrName === 'Name' && tagName.toLowerCase() !== 'action') {
                        return completionItems;
                    }
                    enumValues.forEach((val) => {
                        completionItems.push(new vscode.CompletionItem(val, vscode.CompletionItemKind.Value));
                    });
                }
                return completionItems;
            }
            return completionItems;
        }
    }, '<', ' ', '=', '"', "'", '+', '-', '*', '/', '(');
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
        }
        catch (err) {
            vscode.window.showErrorMessage(`Error creating project: ${err.message}`);
        }
    });
    context.subscriptions.push(completionProvider, createProjectCmd);
}
function deactivate() { }
//# sourceMappingURL=extension.js.map