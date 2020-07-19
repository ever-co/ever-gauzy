import { Connection } from 'typeorm';
import { IntegrationType } from './integration-type.entity';
import {
	IntegrationTypeGroupEnum,
	IntegrationTypeNameEnum
} from '@gauzy/models';

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
	connection: Connection
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
	return await insertIntegrationTypes(connection, integrationTypes);
};

const insertIntegrationTypes = async (
	connection: Connection,
	integrationTypes: IntegrationType[]
): Promise<IntegrationType[]> =>
	await connection.manager.save(integrationTypes);
