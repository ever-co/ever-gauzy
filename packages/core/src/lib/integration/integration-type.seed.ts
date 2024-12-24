import { DataSource } from 'typeorm';
import { IntegrationType } from './integration-type.entity';
import { DEFAULT_INTEGRATION_TYPES } from './default-integration-type';

export const createDefaultIntegrationTypes = async (
	dataSource: DataSource
): Promise<IntegrationType[]> => {
	const integrationTypes = DEFAULT_INTEGRATION_TYPES.map(({ name, groupName, order, icon, description }) => {
		const entity = new IntegrationType();
		entity.name = name;
		entity.groupName = groupName;
		entity.order = order;
		entity.icon = icon;
		entity.description = description;
		return entity;
	});
	return await insertIntegrationTypes(dataSource, integrationTypes);
};

const insertIntegrationTypes = async (
	dataSource: DataSource,
	integrationTypes: IntegrationType[]
): Promise<IntegrationType[]> => {
	return await dataSource.manager.save(integrationTypes);
}
