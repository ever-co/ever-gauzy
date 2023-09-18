import { sluggable } from "@gauzy/common";
import { IntegrationEnum, IntegrationTypeEnum } from "@gauzy/contracts";

export const DEFAULT_INTEGRATIONS = [
    {
        name: IntegrationEnum.HUBSTAFF,
        imgSrc: 'hubstaff.svg',
        isComingSoon: false,
        integrationTypesMap: <string[]>[
            IntegrationTypeEnum.ALL_INTEGRATIONS
        ],
        order: 1,
        navigationUrl: 'hubstaff',
        redirect_url: sluggable(IntegrationEnum.HUBSTAFF),
        provider: IntegrationEnum.HUBSTAFF
    },
    {
        name: IntegrationEnum.UPWORK,
        imgSrc: 'upwork.svg',
        isComingSoon: false,
        integrationTypesMap: <string[]>[
            IntegrationTypeEnum.ALL_INTEGRATIONS
        ],
        order: 2,
        navigationUrl: 'upwork',
        redirect_url: sluggable(IntegrationEnum.UPWORK),
        provider: IntegrationEnum.UPWORK
    },
    {
        name: IntegrationEnum.GAUZY_AI,
        imgSrc: 'gauzy-ai.svg',
        isComingSoon: false,
        integrationTypesMap: <string[]>[
            IntegrationTypeEnum.ALL_INTEGRATIONS
        ],
        order: 3,
        navigationUrl: 'gauzy-ai',
        redirect_url: sluggable(IntegrationEnum.GAUZY_AI),
        provider: IntegrationEnum.GAUZY_AI
    },
    {
        name: 'Import/Export',
        imgSrc: 'import-export.svg',
        isComingSoon: true,
        integrationTypesMap: <string[]>[
            IntegrationTypeEnum.ALL_INTEGRATIONS,
            IntegrationTypeEnum.CRM
        ],
        order: 4,
        navigationUrl: 'import-export',
        redirect_url: sluggable('import-export'),
        provider: 'import_export'
    }
];
