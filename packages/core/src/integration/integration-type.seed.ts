import { DataSource } from 'typeorm';
import { IntegrationType } from './integration-type.entity';
import {
	IntegrationTypeGroupEnum,
	IntegrationTypeNameEnum
} from '@gauzy/contracts';

const DEFAULT_INTEGRATION_TYPES = [
	{
		name: IntegrationTypeNameEnum.ALL_INTEGRATIONS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeNameEnum.FOR_SALES_TEAMS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeNameEnum.FOR_ACCOUNTANTS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeNameEnum.FOR_SUPPORT_TEAMS,
		groupName: IntegrationTypeGroupEnum.FEATURED,
		order: 1
	},
	{
		name: IntegrationTypeNameEnum.CRM,
		groupName: IntegrationTypeGroupEnum.CATEGORIES,
		order: 2
	},
	{
		name: IntegrationTypeNameEnum.SCHEDULING,
		groupName: IntegrationTypeGroupEnum.CATEGORIES,
		order: 2
	},
	{
		name: IntegrationTypeNameEnum.TOOLS,
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
