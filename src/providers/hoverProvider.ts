import * as vscode from 'vscode';
import { Schema } from '../services/schemaParser';
import { EXTENSION_CONSTANTS } from '../constants';

export function createHoverProvider(schema: Schema): vscode.Disposable {
    const actionTag = EXTENSION_CONSTANTS.MAGIC_DATA.ACTION_TAG;
    const regex = EXTENSION_CONSTANTS.REGEX;

    return vscode.languages.registerHoverProvider(
        ['xml', 'magicdata', 'plaintext'],
        {
            provideHover(document: vscode.TextDocument, position: vscode.Position) {
                const range = document.getWordRangeAtPosition(position, /[A-Za-z0-9_-]+/);
                if (!range) {
                    return undefined;
                }

                const word = document.getText(range);
                const lineText = document.lineAt(position.line).text;

                if (lineText.toLowerCase().includes(`<${actionTag.toLowerCase()}`)) {
                    const actionNameMatch = lineText.match(regex.ACTION_NAME_ATTRIBUTE);
                    if (actionNameMatch && actionNameMatch[1] === word) {
                        const specificActionDef = schema.actions[word];
                        if (specificActionDef && specificActionDef.hint) {
                            return new vscode.Hover(new vscode.MarkdownString(specificActionDef.hint));
                        }
                    }
                }

                const elementDef = schema.elements[word];
                if (elementDef && elementDef.hint) {
                    return new vscode.Hover(new vscode.MarkdownString(elementDef.hint));
                }

                const actionDef = schema.actions[word];
                if (actionDef && actionDef.hint) {
                    return new vscode.Hover(new vscode.MarkdownString(actionDef.hint));
                }

                return undefined;
            }
        }
    );
}