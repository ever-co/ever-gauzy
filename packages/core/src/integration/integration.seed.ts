import { DataSource } from 'typeorm';
import { getConfig } from '@gauzy/config';
import { IIntegration, IIntegrationType } from '@gauzy/contracts';
import { cleanAssets, copyAssets } from './../core/seeds/utils';
import { Integration } from './integration.entity';
import { DEFAULT_INTEGRATIONS } from './default-integration';

const config = getConfig();

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

	const destDir = 'integrations';
	await cleanAssets(config, destDir);

	const integrations: IIntegration[] = [];
	for await (const integration of DEFAULT_INTEGRATIONS) {
		const { name, imgSrc, isComingSoon, integrationTypesMap, order, provider, redirectUrl } = integration;

		const entity = new Integration();
		entity.name = name;
		entity.imgSrc = copyAssets(imgSrc, config, destDir);
		entity.isComingSoon = isComingSoon;
		entity.order = order;
		entity.redirectUrl = redirectUrl;
		entity.provider = provider;
		entity.integrationTypes = integrationTypes.filter((it) =>
			integrationTypesMap.includes(it.name)
		);
		integrations.push(entity);
	}

	return await insertIntegrations(dataSource, integrations);
};

const insertIntegrations = async (dataSource: DataSource, integrations: IIntegration[]) => await dataSource.manager.save(integrations);
