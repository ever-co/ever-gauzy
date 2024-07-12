import { IntegrationEntity } from '@gauzy/contracts';

/**
 * Default entity settings for AI integrations.
 *
 * Each entity setting consists of an entity type and a sync flag.
 * The sync flag determines whether the entity type should be synced with the AI integration.
 */
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
