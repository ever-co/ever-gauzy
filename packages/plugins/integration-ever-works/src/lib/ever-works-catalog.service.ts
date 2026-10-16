import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { IntegrationTypeEnum } from '@gauzy/contracts';
import { Integration, IntegrationType } from '@gauzy/core';
import {
	EVER_WORKS_CATALOG_ICON,
	EVER_WORKS_CATALOG_ORDER,
	EVER_WORKS_INTEGRATION_NAME,
	EVER_WORKS_REDIRECT_URL
} from './ever-works.constants';

/** The integration types the Ever Works card is listed under. */
const INTEGRATION_TYPES = [IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.PROJECT_MANAGEMENT];

/**
 * Lists "Ever Works" among Gauzy's integrations: one `integration` catalog row named `Ever_Works`
 * (`IntegrationEnum.EVER_WORKS`), written when the plugin starts and never by a migration or the seed.
 * The row therefore exists only on installations that switched the plugin on (`EVER_WORKS_ENABLED=true`);
 * with the switch off nothing is written and the Integrations page is unchanged.
 *
 * Safe when several API processes start at once, on every database: the insert does nothing when the
 * row exists (its name is unique), Postgres serialises the processes with a transaction-scoped advisory
 * lock and MySQL with a row lock before the integration types are attached.
 */
@Injectable()
export class EverWorksCatalogService {
	constructor(private readonly dataSource: DataSource) {}

	/** Upserts the catalog row and attaches any missing integration type; returns the row. */
	async ensure(): Promise<Integration> {
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			if (type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['ever-works:catalog']);
			}
			await manager
				.createQueryBuilder()
				.insert()
				.into(Integration)
				.values({
					id: randomUUID(),
					name: EVER_WORKS_INTEGRATION_NAME,
					provider: EVER_WORKS_INTEGRATION_NAME,
					imgSrc: EVER_WORKS_CATALOG_ICON,
					redirectUrl: EVER_WORKS_REDIRECT_URL,
					isComingSoon: false,
					isPaid: false,
					order: EVER_WORKS_CATALOG_ORDER
				})
				.orIgnore()
				.execute();
			if (type === 'mysql' || type === 'mariadb') {
				await manager.findOneOrFail(Integration, {
					where: { name: EVER_WORKS_INTEGRATION_NAME },
					lock: { mode: 'pessimistic_write' }
				});
			}
			const integration = await manager.findOneOrFail(Integration, {
				where: { name: EVER_WORKS_INTEGRATION_NAME },
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
