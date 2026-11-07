import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { IntegrationTypeEnum } from '@gauzy/contracts';
import { Integration, IntegrationType } from '@gauzy/core';
import { LINEAR_CATALOG_ICON, LINEAR_CATALOG_ORDER, LINEAR_INTEGRATION_NAME, LINEAR_REDIRECT_URL } from './linear.constants';

/** The integration types the Linear card is listed under. */
const INTEGRATION_TYPES = [IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.PROJECT_MANAGEMENT];

/**
 * Lists "Linear" among the platform's integrations: one `integration` catalogue row named `Linear`
 * (`IntegrationEnum.LINEAR`), written when the plugin starts. A fresh database gets it from the seed as
 * well (`DEFAULT_INTEGRATIONS`); an existing one gets it here, the first time the plugin runs.
 *
 * Safe when several API processes start at once, on every database: the insert does nothing when the
 * row exists (its name is unique), Postgres serialises the processes with a transaction-scoped advisory
 * lock and MySQL with a row lock before the integration types are attached.
 */
@Injectable()
export class LinearCatalogService {
	constructor(private readonly dataSource: DataSource) {}

	/** Upserts the catalogue row and attaches any missing integration type; returns the row. */
	async ensure(): Promise<Integration> {
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			if (type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['integration-linear:catalog']);
			}
			await manager
				.createQueryBuilder()
				.insert()
				.into(Integration)
				.values({
					id: randomUUID(),
					name: LINEAR_INTEGRATION_NAME,
					provider: LINEAR_INTEGRATION_NAME,
					imgSrc: LINEAR_CATALOG_ICON,
					redirectUrl: LINEAR_REDIRECT_URL,
					isComingSoon: false,
					isPaid: false,
					order: LINEAR_CATALOG_ORDER
				})
				.orIgnore()
				.execute();
			if (type === 'mysql' || type === 'mariadb') {
				await manager.findOneOrFail(Integration, {
					where: { name: LINEAR_INTEGRATION_NAME },
					lock: { mode: 'pessimistic_write' }
				});
			}
			const integration = await manager.findOneOrFail(Integration, {
				where: { name: LINEAR_INTEGRATION_NAME },
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
