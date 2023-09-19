import { IntegrationTypeEnum, IntegrationTypeGroupEnum } from "@gauzy/contracts";

export const DEFAULT_INTEGRATION_TYPES = [
    {
        name: IntegrationTypeEnum.ALL_INTEGRATIONS,
        groupName: IntegrationTypeGroupEnum.FEATURED,
        order: 1,
        description: null,
        icon: null
    },
    {
        name: IntegrationTypeEnum.FOR_SALES_TEAMS,
        groupName: IntegrationTypeGroupEnum.FEATURED,
        order: 1,
        description: null,
        icon: null
    },
    {
        name: IntegrationTypeEnum.FOR_ACCOUNTANTS,
        groupName: IntegrationTypeGroupEnum.FEATURED,
        order: 1,
        description: null,
        icon: null
    },
    {
        name: IntegrationTypeEnum.FOR_SUPPORT_TEAMS,
        groupName: IntegrationTypeGroupEnum.FEATURED,
        order: 1,
        description: null,
        icon: null
    },
    {
        name: IntegrationTypeEnum.CRM,
        groupName: IntegrationTypeGroupEnum.CATEGORIES,
        order: 2,
        description: null,
        icon: null
    },
    {
        name: IntegrationTypeEnum.SCHEDULING,
        groupName: IntegrationTypeGroupEnum.CATEGORIES,
        order: 2,
        description: null,
        icon: null
    },
    {
        name: IntegrationTypeEnum.PROJECT_MANAGEMENT,
        groupName: IntegrationTypeGroupEnum.CATEGORIES,
        order: 2,
        description: null,
        icon: null
    },
    {
        name: IntegrationTypeEnum.COMMUNICATION,
        groupName: IntegrationTypeGroupEnum.CATEGORIES,
        order: 2,
        description: null,
        icon: null
    }
];
