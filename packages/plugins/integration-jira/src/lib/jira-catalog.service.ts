import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, In } from 'typeorm';
import { IntegrationTypeEnum } from '@gauzy/contracts';
import { Integration, IntegrationType } from '@gauzy/core';
import { JIRA_CATALOG_ICON, JIRA_CATALOG_ORDER, JIRA_INTEGRATION_NAME, JIRA_REDIRECT_URL } from './jira.constants';

/** The integration types the Jira card is listed under. */
const INTEGRATION_TYPES = [IntegrationTypeEnum.ALL_INTEGRATIONS, IntegrationTypeEnum.PROJECT_MANAGEMENT];

/**
 * Lists "Jira" among the platform's integrations: one `integration` catalogue row named `Jira`
 * (`IntegrationEnum.JIRA`), written when the sync starts. The seed (`DEFAULT_INTEGRATIONS`) lists the card as
 * "coming soon" since before the sync existed: with the sync loaded the card is opened (`isComingSoon` false), and a
 * database without the row gets it here, the first time the sync runs.
 *
 * Safe when several API processes start at once, on every database: the insert does nothing when the
 * row exists (its name is unique), Postgres serialises the processes with a transaction-scoped advisory
 * lock and MySQL with a row lock before the integration types are attached.
 */
@Injectable()
export class JiraCatalogService {
	constructor(private readonly dataSource: DataSource) {}

	/** Upserts the catalogue row and attaches any missing integration type; returns the row. */
	async ensure(): Promise<Integration> {
		return this.dataSource.transaction(async (manager) => {
			const type = manager.connection.options.type;
			if (type === 'postgres') {
				await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['integration-jira:catalog']);
			}
			await manager
				.createQueryBuilder()
				.insert()
				.into(Integration)
				.values({
					id: randomUUID(),
					name: JIRA_INTEGRATION_NAME,
					provider: JIRA_INTEGRATION_NAME,
					imgSrc: JIRA_CATALOG_ICON,
					redirectUrl: JIRA_REDIRECT_URL,
					isComingSoon: false,
					isPaid: false,
					order: JIRA_CATALOG_ORDER
				})
				.orIgnore()
				.execute();
			if (type === 'mysql' || type === 'mariadb') {
				await manager.findOneOrFail(Integration, {
					where: { name: JIRA_INTEGRATION_NAME },
					lock: { mode: 'pessimistic_write' }
				});
			}
			// The seed's card says "coming soon": the sync is here, so the card opens.
			await manager.update(Integration, { name: JIRA_INTEGRATION_NAME, isComingSoon: true } as never, { isComingSoon: false } as never);
			const integration = await manager.findOneOrFail(Integration, {
				where: { name: JIRA_INTEGRATION_NAME },
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
