import { DataSource } from 'typeorm';
import { IIntegration, DEFAULT_INTEGRATIONS, IIntegrationType } from '@gauzy/contracts';
import { Integration } from './integration.entity';

export const createDefaultIntegrations = async (
	dataSource: DataSource,
	integrationTypes: IIntegrationType[] | void
): Promise<IIntegration[]> => {
	if (!integrationTypes) {
		console.warn(
			'Warning: integrationTypes not found, DefaultIntegrations will not be created'
		);
		return;
	}

	const integrations: IIntegration[] = [];
	DEFAULT_INTEGRATIONS.forEach(
		({ name, imgSrc, isComingSoon, integrationTypesMap, order }) => {
			const entity = new Integration();
			entity.name = name;
			entity.imgSrc = imgSrc;
			entity.isComingSoon = isComingSoon;
			entity.order = order;
			entity.integrationTypes = integrationTypes.filter((it) =>
				integrationTypesMap.includes(it.name)
			);

			integrations.push(entity);
		}
	);

	return insertIntegrations(dataSource, integrations);
};

const insertIntegrations = async (
	dataSource: DataSource,
	integrations: IIntegration[]
) => await dataSource.manager.save(integrations);
