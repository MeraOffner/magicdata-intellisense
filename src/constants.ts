export const EXTENSION_CONSTANTS = {
    MESSAGES: {
        LOADED: 'MagicData Extension Loaded Successfully!',
        PROJECT_CREATED: 'MagicData project created successfully!',
        ERROR_PREFIX: 'Error creating project: '
    },
    COMMANDS: {
        CREATE_PROJECT: 'magicdata.createProject'
    },
    FILES: {
        MD_LANG_XML: 'MDLang.xml',
        WORKFIELDS_XML: 'WorkFields.xml',
        MAIN_JTM: 'main.jtm'
    },
    FOLDERS: {
        LIST: ['Input', 'InputDef', 'Output', 'OutputDef', 'Lookup', 'LookupDef', 'Log'],
        LOOKUP_DEF: 'LookupDef'
    },
    MAGIC_DATA: {
        ACTION_TAG: 'ACTION',
        TRIGGER_CHARACTERS: ['<', ' ', '=', '"', "'", '+', '-', '*', '/', '('],
        LEN_OPTIONS: ['10', '20', '30', '50', '100', '255']
    },
    REGEX: {
        TAG_COMPLETION: /<([A-Za-z0-9_-]*)$/,
        OPEN_TAG_ATTRIBUTES: /<([A-Za-z0-9_-]+)(?:\s+[\w-]+=*(?:"[^"]*"|'[^']*')?)*\s+([\w-]*)$/,
        LAST_ATTRIBUTE_VALUE: /([A-Za-z0-9_-]+)=["']([^"']*)$/,
        CURRENT_TAG_NAME: /<([A-Za-z0-9_-]+)\b[^>]*$/,
        ACTION_NAME_ATTRIBUTE: /Name=["']([^"']+)["']/i,
        ATTRIBUTE_EXISTS: (attrName: string) => new RegExp(`\\b${attrName}=`, 'i')
    },
    SNIPPETS: {
        ATTRIBUTE: (attr: string, index: number) => `${attr}="$${index}"`,
        SELF_CLOSING_TAG: (tagName: string, attrsSnippet: string) => `${tagName}${attrsSnippet} />`,
        OPEN_CLOSE_TAG: (tagName: string, attrsSnippet: string, contentIndex: number) => 
            `${tagName}${attrsSnippet}>\n\t$${contentIndex}\n</${tagName}>`,
        ACTION_WITH_SUFFIX: (actionName: string, suffix: string) => `${actionName}${suffix}`,
        ACTION_WITH_SUFFIX_AND_QUOTE: (actionName: string, suffix: string) => `${actionName}"${suffix}`
    },
    TEMPLATES: {
        WORKFIELDS_CONTENT: `<?xml version="1.0" encoding="UTF-8"?>\n<WORKFIELDS Name="workfields">\n\t<Field Name="v_Status" Type="String" Len="10" />\n</WORKFIELDS>`,
        MAIN_JTM_CONTENT: (projectPath: string) => 
            `<?xml version="1.0" encoding="UTF-8"?>\n<Job Name="NewProject" Company="MyCompany" ProjectVersion="1.0.0" Category="APPLICATION" BasePath="${projectPath}">\n\t<WORKFIELDS Name="WorkFields" FileName="WorkFields.xml" />\n\t<Task Name="MainTask">\n\t\t\n\t</Task>\n</Job>`
    }
} as const;