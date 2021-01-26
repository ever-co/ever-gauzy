import { Connection } from 'typeorm';
import { IIntegration, DEFAULT_INTEGRATIONS } from '@gauzy/contracts';
import { IntegrationType } from './integration-type.entity';
import { Integration } from './integration.entity';

export const createDefaultIntegrations = async (
	connection: Connection,
	integrationTypes: IntegrationType[] | void
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

	return insertIntegrations(connection, integrations);
};

const insertIntegrations = async (
	connection: Connection,
	integrations: IIntegration[]
) => await connection.manager.save(integrations);
