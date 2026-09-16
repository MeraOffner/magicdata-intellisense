import * as vscode from 'vscode';
import { Schema } from '../services/schemaParser';

export function registerDiagnostics(context: vscode.ExtensionContext, schema: Schema) {
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('magicdata');
    context.subscriptions.push(diagnosticCollection);

    function validateDocument(document: vscode.TextDocument) {
        if (!['xml', 'magicdata', 'plaintext'].includes(document.languageId)) return;

        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();

        // 1. Check for unclosed syntax tags (Missing '>' bracket)
        // Matches '<' followed by tag name and attributes, but line ends or new tag starts before '>'
        const unclosedBracketRegex = /<(\/)?([A-Za-z0-9_-]+)(?:\s+[^>\n]*?)?(?=\n|<|$)/g;
        let unclosedMatch: RegExpExecArray | null;

        while ((unclosedMatch = unclosedBracketRegex.exec(text)) !== null) {
            const matchedText = unclosedMatch[0];
            // If the matched string doesn't end with '>', it's missing the closing '>' bracket
            if (!matchedText.endsWith('>')) {
                const startPos = document.positionAt(unclosedMatch.index);
                const endPos = document.positionAt(unclosedMatch.index + matchedText.length);
                const range = new vscode.Range(startPos, endPos);

                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Syntax Error: Tag '${unclosedMatch[2]}' is missing closing '>' bracket`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }

        // 2. Stack-based validation for missing closing tags (e.g. <Task> without </Task>)
        const tagRegex = /<(\/)?([A-Za-z0-9_-]+)(?:\s+[^>]*?)?(\/)?>/g;
        let match: RegExpExecArray | null;
        const tagStack: { name: string; index: number; length: number }[] = [];

        while ((match = tagRegex.exec(text)) !== null) {
            const isClosing = Boolean(match[1]);
            const tagName = match[2];
            const tagNameUpper = tagName.toUpperCase();
            const isSelfClosingSlash = Boolean(match[3]);

            const elementDef = schema.elements[tagName] || schema.elements[tagNameUpper];
            const isSelfClosingSchema = elementDef ? elementDef.isSelfClosing : false;

            if (isSelfClosingSlash || isSelfClosingSchema) {
                continue;
            }

            if (!isClosing) {
                tagStack.push({
                    name: tagNameUpper,
                    index: match.index,
                    length: match[0].length
                });
            } else {
                if (tagStack.length > 0 && tagStack[tagStack.length - 1].name === tagNameUpper) {
                    tagStack.pop();
                }
            }
        }

        // Any remaining tag in stack is missing its </TagName>
        tagStack.forEach(openTag => {
            const startPos = document.positionAt(openTag.index);
            const endPos = document.positionAt(openTag.index + openTag.length);
            const range = new vscode.Range(startPos, endPos);

            diagnostics.push(new vscode.Diagnostic(
                range,
                `Missing closing tag </${openTag.name}>`,
                vscode.DiagnosticSeverity.Error
            ));
        });

        diagnosticCollection.set(document.uri, diagnostics);
    }

    vscode.workspace.onDidOpenTextDocument(validateDocument, null, context.subscriptions);
    vscode.workspace.onDidChangeTextDocument(e => validateDocument(e.document), null, context.subscriptions);
    vscode.workspace.onDidSaveTextDocument(validateDocument, null, context.subscriptions);

    if (vscode.window.activeTextEditor) {
        validateDocument(vscode.window.activeTextEditor.document);
    }
}