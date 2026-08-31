import * as fs from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { EXTENSION_CONSTANTS } from '../constants';

export interface AttributeDefinition {
    name: string;
    isRequired: boolean;
    allowedValues: string[];
}

export interface ElementDefinition {
    name: string;
    hint: string;
    isSelfClosing: boolean;
    attributes: { [attrName: string]: AttributeDefinition };
}

export interface Schema {
    elements: { [tagName: string]: ElementDefinition };
    actions: { [actionName: string]: ElementDefinition };
    expressions: string[];
}

export function parseMDLangXml(xmlPath: string): Schema {
    const schema: Schema = {
        elements: {},
        actions: {},
        expressions: []
    };

    if (!fs.existsSync(xmlPath)) {
        return schema;
    }

    const xmlData = fs.readFileSync(xmlPath, 'utf8');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const jsonObj = parser.parse(xmlData);
    const root = jsonObj.MagicDataLanguage;

    const actionTag = EXTENSION_CONSTANTS.MAGIC_DATA.ACTION_TAG;

    // 1. AutoCompleteExpressions
    const exprRows = root?.AutoCompleteExpression?.Row;
    if (Array.isArray(exprRows)) {
        exprRows.forEach((row: any) => {
            const attr = row['@_MdLangAttr'];
            if (attr && !schema.expressions.includes(attr)) {
                schema.expressions.push(attr);
            }
        });
    }

    // 2. nonSelfClosingTags
    const nonSelfClosingTags = new Set<string>();
    const startTagRows = root?.AutoCompleteStartTag?.Row;
    if (Array.isArray(startTagRows)) {
        startTagRows.forEach((row: any) => {
            const tagName = row['@_MdLangAttr'];
            const autoCompletePattern = row['@_AutoComplete'] || '';

            if (tagName && (autoCompletePattern.includes(`/${tagName}`) || autoCompletePattern.includes(`/${tagName.toUpperCase()}`))) {
                nonSelfClosingTags.add(tagName.toLowerCase());
            }
        });
    }

    // 3. Parse Elements & Attributes
    const elementsList = root?.Element;
    if (Array.isArray(elementsList)) {
        elementsList.forEach((elem: any) => {
            const key = elem['@_Key'];
            const name = elem['@_Name'] || key;
            const type = elem['@_Type'];
            const hint = elem['@_Hint'] || '';

            let attributesRaw = elem.Attribute;
            if (attributesRaw && !Array.isArray(attributesRaw)) {
                attributesRaw = [attributesRaw];
            }

            const parsedAttributes: { [attrName: string]: AttributeDefinition } = {};

            if (attributesRaw) {
                attributesRaw.forEach((attr: any) => {
                    const attrName = attr['@_Name'];
                    if (!attrName) return;

                    const isReq = attr['@_Required'] === 'True' || attr['@_Required'] === 'true';

                    let allowedValues: string[] = [];
                    if (attr.Enum) {
                        const enumList = Array.isArray(attr.Enum) ? attr.Enum : [attr.Enum];
                        allowedValues = enumList
                            .map((v: any) => String(v).trim())
                            .filter((v: string) => v !== '');
                    }

                    parsedAttributes[attrName] = {
                        name: attrName,
                        isRequired: isReq,
                        allowedValues: allowedValues
                    };
                });
            }

            const isSelfClosing = !nonSelfClosingTags.has((name || '').toLowerCase());

            const elementDef: ElementDefinition = {
                name: name,
                hint: hint,
                isSelfClosing: isSelfClosing,
                attributes: parsedAttributes
            };

            if (type === 'Action' && key && key.toUpperCase() !== actionTag) {
                schema.actions[key] = elementDef;
            } else if (name && !schema.elements[name]) {
                schema.elements[name] = elementDef;
            }

            // Collect sub-actions from ACTION Name enums
            if (name === actionTag && attributesRaw) {
                attributesRaw.forEach((attr: any) => {
                    if (attr['@_Name'] === 'Name' && attr.Enum) {
                        const enumValues = Array.isArray(attr.Enum) ? attr.Enum : [attr.Enum];
                        enumValues.forEach((actName: string) => {
                            if (actName && actName.toUpperCase() !== actionTag && !schema.actions[actName]) {
                                schema.actions[actName] = {
                                    name: actName,
                                    hint: `MagicData Action: ${actName}`,
                                    isSelfClosing: true,
                                    attributes: {}
                                };
                            }
                        });
                    }
                });
            }
        });
    }

    // 4. Register Core Elements
    const mdElements = root?.MDElements?.Row;
    if (Array.isArray(mdElements)) {
        mdElements.forEach((row: any) => {
            const tag = row['@_Name'];
            if (tag) {
                const tagName = tag.toLowerCase() === actionTag.toLowerCase() ? actionTag : tag;
                if (!schema.elements[tagName]) {
                    schema.elements[tagName] = {
                        name: tagName,
                        hint: `MagicData Element: ${tagName}`,
                        isSelfClosing: !nonSelfClosingTags.has(tagName.toLowerCase()),
                        attributes: {}
                    };
                }
            }
        });
    }

   // 5. Keep ACTION element clean with only its basic schema attributes
    if (schema.elements[actionTag]) {
        const actionElement = schema.elements[actionTag];

        // Ensure common required/optional base attributes for ACTION tag itself
        ['Name', 'Alias', 'Value', 'Field', 'Rule', 'Expression'].forEach(attrName => {
            if (!actionElement.attributes[attrName]) {
                actionElement.attributes[attrName] = {
                    name: attrName,
                    isRequired: attrName === 'Name',
                    allowedValues: []
                };
            }
        });
    }

    return schema;
}
