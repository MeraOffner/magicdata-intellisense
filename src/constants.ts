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
    FOLDERS: ['Input', 'InputDef', 'Output', 'OutputDef', 'Lookup', 'LookupDef', 'Log'],
    MAGIC_DATA: {
        ACTION_TAG: 'ACTION'
    },
    TEMPLATES: {
        WORKFIELDS_CONTENT: `<?xml version="1.0" encoding="UTF-8"?>\n<WORKFIELDS Name="workfields">\n\t<Field Name="v_Status" Type="String" Len="10" />\n</WORKFIELDS>`,
        MAIN_JTM_CONTENT: (projectPath: string) => 
            `<?xml version="1.0" encoding="UTF-8"?>\n<Job Name="NewProject" Company="MyCompany" ProjectVersion="1.0.0" Category="APPLICATION" BasePath="${projectPath}">\n\t<WORKFIELDS Name="WorkFields" FileName="WorkFields.xml" />\n\t<Task Name="MainTask">\n\t\t\n\t</Task>\n</Job>`
    }
} as const;