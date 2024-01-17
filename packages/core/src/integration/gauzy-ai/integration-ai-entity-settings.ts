import { IntegrationEntity } from '@gauzy/contracts';

export const DEFAULT_ENTITY_SETTINGS = [
    {
        entity: IntegrationEntity.JOB_MATCHING,
        sync: true
    },
    {
        entity: IntegrationEntity.EMPLOYEE_PERFORMANCE,
        sync: true
    }
];
