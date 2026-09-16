import * as vscode from 'vscode';
import * as path from 'path';
import { EXTENSION_CONSTANTS } from './constants';
import { parseMDLangXml } from './services/schemaParser';
import { createCompletionProvider } from './providers/completionProvider';
import { createHoverProvider } from './providers/hoverProvider'; 
import { registerCreateProjectCommand } from './commands/projectCommands';
import { registerDiagnostics } from './providers/diagnosticsProvider';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage(EXTENSION_CONSTANTS.MESSAGES.LOADED);

    // Parse XML Schema dynamically via Service
    const xmlPath = path.join(context.extensionPath, EXTENSION_CONSTANTS.FILES.MD_LANG_XML);
    const schema = parseMDLangXml(xmlPath);

    // Register Diagnostics (Validation)
    registerDiagnostics(context, schema);

    // Register Providers
    const completionProvider = createCompletionProvider(schema);
    const hoverProvider = createHoverProvider(schema);

    // Register Commands
    const createProjectCmd = registerCreateProjectCommand();

    context.subscriptions.push(completionProvider, hoverProvider, createProjectCmd);
}

export function deactivate() {}