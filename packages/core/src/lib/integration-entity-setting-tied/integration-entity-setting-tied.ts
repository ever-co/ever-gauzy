import { IntegrationEntity } from '@gauzy/contracts';

/**
 * Interface for entity synchronization settings.
 */
interface IEntitySyncSetting {
	entity: IntegrationEntity;
	sync: boolean;
}

/**
 * Project-tied entities that need to be synchronized.
 */
export const PROJECT_TIED_ENTITIES: IEntitySyncSetting[] = [
	{
		entity: IntegrationEntity.TASK,
		sync: true
	},
	{
		entity: IntegrationEntity.ACTIVITY,
		sync: true
	},
	{
		entity: IntegrationEntity.SCREENSHOT,
		sync: true
	}
];
