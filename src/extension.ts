import * as vscode from 'vscode';
import * as path from 'path';
import { EXTENSION_CONSTANTS } from './constants';
import { parseMDLangXml } from './services/schemaParser';
import { createCompletionProvider } from './providers/completionProvider';
import { createHoverProvider } from './providers/hoverProvider'; // <- יבוא חדש
import { registerCreateProjectCommand } from './commands/projectCommands';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage(EXTENSION_CONSTANTS.MESSAGES.LOADED);

    // 1. Parse XML Schema dynamically via Service
    const xmlPath = path.join(context.extensionPath, EXTENSION_CONSTANTS.FILES.MD_LANG_XML);
    const schema = parseMDLangXml(xmlPath);

    // 2. Register Providers
    const completionProvider = createCompletionProvider(schema);
    const hoverProvider = createHoverProvider(schema); // <- יצירת ה-Hover Provider

    // 3. Register Commands
    const createProjectCmd = registerCreateProjectCommand();

    context.subscriptions.push(completionProvider, hoverProvider, createProjectCmd);
}

export function deactivate() {}