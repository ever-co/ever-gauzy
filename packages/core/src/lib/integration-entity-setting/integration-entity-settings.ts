import { IntegrationEntity } from '@gauzy/contracts';

/**
 * Interface for entity synchronization settings.
 */
interface IEntitySyncSetting {
	entity: IntegrationEntity;
	sync: boolean;
}

/**
 * Default settings for entities to be synchronized.
 */
export const DEFAULT_ENTITY_SETTINGS: IEntitySyncSetting[] = [
	{
		entity: IntegrationEntity.ORGANIZATION,
		sync: true
	},
	{
		entity: IntegrationEntity.PROJECT,
		sync: true
	},
	{
		entity: IntegrationEntity.CLIENT,
		sync: true
	}
];
