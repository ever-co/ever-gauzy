import { Connection } from 'typeorm';
import { IntegrationEnum, IntegrationTypeNameEnum } from '@gauzy/models';
import { IntegrationType } from './integration-type.entity';
import { Integration } from './integration.entity';

const DEFAULT_INTEGRATIONS = [
	{
		name: IntegrationEnum.HUBSTAFF,
		imgSrc:
			'https://account.hubstaff.com/assets/hubstaff/logos/HS_text_logo_black-18504e00c286dca13b2c503b94d1eabdf6e1c45257ca558b78095c4e184a020c.svg',
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS
		]
	},
	{
		name: IntegrationEnum.UPWORK,
		imgSrc: 'assets/images/integrations/upwork.svg',
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS
		]
	},
	{
		name: 'Import/Export',
		imgSrc: 'assets/images/integrations/import-export.svg',
		isComingSoon: true,
		integrationTypesMap: <string[]>[
			IntegrationTypeNameEnum.ALL_INTEGRATIONS,
			IntegrationTypeNameEnum.CRM
		]
	}
];

export const createDefaultIntegrations = async (
	connection: Connection,
	integrationTypes: IntegrationType[] | void
): Promise<Integration[]> => {
	if (!integrationTypes) {
		console.warn(
			'Warning: integrationTypes not found, DefaultIntegrations will not be created'
		);
		return;
	}

	const integrations = DEFAULT_INTEGRATIONS.map(
		({ name, imgSrc, isComingSoon, integrationTypesMap }) => {
			const entity = new Integration();
			entity.name = name;
			entity.imgSrc = imgSrc;
			entity.isComingSoon = isComingSoon;
			entity.integrationTypes = integrationTypes.filter((it) =>
				integrationTypesMap.includes(it.name)
			);
			return entity;
		}
	);

	return insertIntegrations(connection, integrations);
};

const insertIntegrations = async (
	connection: Connection,
	integrations: Integration[]
) => await connection.manager.save(integrations);
