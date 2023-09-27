import { IntegrationEntity } from '@gauzy/contracts';

export const DEFAULT_ENTITY_SETTINGS = [
    {
        entity: IntegrationEntity.PROJECT,
        sync: true
    }
];

export const PROJECT_TIED_ENTITIES = [
    {
        entity: IntegrationEntity.ISSUE,
        sync: true
    },
    {
        entity: IntegrationEntity.LABEL,
        sync: true
    }
];
