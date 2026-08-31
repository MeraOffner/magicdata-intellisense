import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { EXTENSION_CONSTANTS } from './constants';
import { parseMDLangXml } from './services/schemaParser';
import { createCompletionProvider } from './providers/completionProvider';

export function activate(context: vscode.ExtensionContext) {
    vscode.window.showInformationMessage(EXTENSION_CONSTANTS.MESSAGES.LOADED);

    // 1. Parse XML Schema dynamically via Service
    const xmlPath = path.join(context.extensionPath, EXTENSION_CONSTANTS.FILES.MD_LANG_XML);
    const schema = parseMDLangXml(xmlPath);

    // 2. Register Completion Provider
    const completionProvider = createCompletionProvider(schema);

    // 3. Register Command for creating a new project
    const createProjectCmd = vscode.commands.registerCommand(EXTENSION_CONSTANTS.COMMANDS.CREATE_PROJECT, async () => {
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
            for (const folder of EXTENSION_CONSTANTS.FOLDERS) {
                const dirPath = path.join(projectPath, folder);
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }
            }

            const workfieldsPath = path.join(projectPath, 'LookupDef', EXTENSION_CONSTANTS.FILES.WORKFIELDS_XML);
            if (!fs.existsSync(workfieldsPath)) {
                fs.writeFileSync(workfieldsPath, EXTENSION_CONSTANTS.TEMPLATES.WORKFIELDS_CONTENT, { encoding: 'utf8', flag: 'w' });
            }

            const jtmPath = path.join(projectPath, EXTENSION_CONSTANTS.FILES.MAIN_JTM);
            const initialJtmContent = EXTENSION_CONSTANTS.TEMPLATES.MAIN_JTM_CONTENT(projectPath);
            fs.writeFileSync(jtmPath, initialJtmContent, { encoding: 'utf8', flag: 'w' });

            const doc = await vscode.workspace.openTextDocument(jtmPath);
            await vscode.window.showTextDocument(doc);

            vscode.window.showInformationMessage(EXTENSION_CONSTANTS.MESSAGES.PROJECT_CREATED);
        } catch (err: any) {
            vscode.window.showErrorMessage(`${EXTENSION_CONSTANTS.MESSAGES.ERROR_PREFIX}${err.message}`);
        }
    });

    context.subscriptions.push(completionProvider, createProjectCmd);
}

export function deactivate() {}