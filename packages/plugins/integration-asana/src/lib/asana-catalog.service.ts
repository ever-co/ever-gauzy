import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { IntegrationTypeEnum } from '@gauzy/contracts';
import { Integration, IntegrationType } from '@gauzy/core';
import { ASANA_CATALOG_ICON, ASANA_CATALOG_ORDER, ASANA_INTEGRATION_NAME, ASANA_REDIRECT_URL } from './asana.constants';

/** The integration types the Asana card is listed under. */
const INTEGRATION_TYPES = [IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.PROJECT_MANAGEMENT];

/**
 * Lists "Asana" among the platform's integrations: one `integration` catalogue row named `Asana`
 * (`IntegrationEnum.ASANA`), written when the plugin starts. A fresh database gets it from the seed as
 * well (`DEFAULT_INTEGRATIONS`); an existing one gets it here, the first time the plugin runs.
 *
 * Safe when several API processes start at once, on every database: the insert does nothing when the
 * row exists (its name is unique), Postgres serialises the processes with a transaction-scoped advisory
 * lock and MySQL with a row lock before the integration types are attached.
 */
@Injectable()
export class AsanaCatalogService {
	constructor(private readonly dataSource: DataSource) {}

	/** Upserts the catalogue row and attaches any missing integration type; returns the row. */
	async ensure(): Promise<Integration> {
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			if (type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['integration-asana:catalog']);
			}
			await manager
				.createQueryBuilder()
				.insert()
				.into(Integration)
				.values({
					id: randomUUID(),
					name: ASANA_INTEGRATION_NAME,
					provider: ASANA_INTEGRATION_NAME,
					imgSrc: ASANA_CATALOG_ICON,
					redirectUrl: ASANA_REDIRECT_URL,
					isComingSoon: false,
					isPaid: false,
					order: ASANA_CATALOG_ORDER
				})
				.orIgnore()
				.execute();
			if (type === 'mysql' || type === 'mariadb') {
				await manager.findOneOrFail(Integration, {
					where: { name: ASANA_INTEGRATION_NAME },
					lock: { mode: 'pessimistic_write' }
				});
			}
			const integration = await manager.findOneOrFail(Integration, {
				where: { name: ASANA_INTEGRATION_NAME },
				relations: { integrationTypes: true }
			});
			const types = await manager.find(IntegrationType, { where: { name: In(INTEGRATION_TYPES) } });
			const missing = types.filter(
				(candidate) => !integration.integrationTypes?.some((current) => current.id === candidate.id)
			);
			if (!missing.length) {
				return integration;
			}
			integration.integrationTypes = [...(integration.integrationTypes ?? []), ...missing];
			return manager.save(Integration, integration);
		});
	}
}
