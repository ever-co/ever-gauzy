import { IntegrationEntity } from '@gauzy/models';
import { DeepPartial } from 'typeorm';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';

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
	}
] as DeepPartial<IntegrationEntitySetting>;
