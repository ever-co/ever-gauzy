import { IntegrationEntity } from '@gauzy/contracts';

export const DEFAULT_ENTITY_SETTINGS = [
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

export const PROJECT_TIED_ENTITIES = [
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
