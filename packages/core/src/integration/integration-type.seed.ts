import { DataSource } from 'typeorm';
import { IntegrationType } from './integration-type.entity';
import {
	IntegrationTypeGroupEnum,
	IntegrationTypeEnum
} from '@gauzy/contracts';

const DEFAULT_INTEGRATION_TYPES = [
	{
		name: IntegrationTypeEnum.ALL_INTEGRATIONS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeEnum.FOR_SALES_TEAMS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeEnum.FOR_ACCOUNTANTS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeEnum.FOR_SUPPORT_TEAMS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeEnum.CRM,
		groupName: IntegrationTypeGroupEnum.CATEGORIES,
		order: 2
	},
	{
		name: IntegrationTypeEnum.SCHEDULING,
		groupName: IntegrationTypeGroupEnum.CATEGORIES,
		order: 2
	},
	{
		name: IntegrationTypeEnum.TOOLS,
		groupName: IntegrationTypeGroupEnum.CATEGORIES,
		order: 2
	}
];

export const createDefaultIntegrationTypes = async (
	dataSource: DataSource
): Promise<IntegrationType[]> => {
	const integrationTypes = DEFAULT_INTEGRATION_TYPES.map(
		({ name, groupName, order }) => {
			const entity = new IntegrationType();
			entity.name = name;
			entity.groupName = groupName;
			entity.order = order;
			return entity;
		}
	);
	return await insertIntegrationTypes(dataSource, integrationTypes);
};

const insertIntegrationTypes = async (
	dataSource: DataSource,
	integrationTypes: IntegrationType[]
): Promise<IntegrationType[]> =>
	await dataSource.manager.save(integrationTypes);
