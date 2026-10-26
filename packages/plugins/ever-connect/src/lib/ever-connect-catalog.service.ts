import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { LINK_INTEGRATION_NAME } from './ever-connect.constants';
import { EverConnectSql } from './ever-connect-sql';

/** The integration types the Ever Platform card is listed under. */
const INTEGRATION_TYPES = ['All Integrations'];

/**
 * Lists "Ever Platform" among Gauzy's integrations: one `integration` catalog row named
 * `Ever_Connect` (`IntegrationEnum.EVER_CONNECT`), written when the module starts (never by a
 * migration). Safe when several API processes start at once: on Postgres a transaction-scoped
 * advisory lock serialises them, and the insert does nothing when the row exists (its name is
 * unique), on every database.
 */
@Injectable()
export class EverConnectCatalogService {
	private readonly sql: EverConnectSql;

	constructor(dataSource: DataSource) {
		this.sql = new EverConnectSql(dataSource);
	}

	async ensure(): Promise<void> {
		const d = this.sql.dialect;
		const q = (c: string) => this.sql.q(c);
		const ph = (i: number) => this.sql.ph(i);
		const insertIgnore = (table: string, columns: string[]) => {
			const cols = columns.map(q).join(', ');
			const marks = columns.map((_, i) => ph(i + 1)).join(', ');
			if (d === 'postgres') return `INSERT INTO ${q(table)} (${cols}) VALUES (${marks}) ON CONFLICT DO NOTHING`;
			if (d === 'mysql') return `INSERT IGNORE INTO ${q(table)} (${cols}) VALUES (${marks})`;
			return `INSERT OR IGNORE INTO ${q(table)} (${cols}) VALUES (${marks})`;
		};
		await this.sql.transaction('ever-connect:catalog', async (tx) => {
			await tx.query(
				insertIgnore('integration', [
					'id',
					'name',
					'provider',
					'imgSrc',
					'redirectUrl',
					'isComingSoon',
					'isPaid',
					'order'
				]),
				[
					randomUUID(),
					LINK_INTEGRATION_NAME,
					LINK_INTEGRATION_NAME,
					'integrations/ever-platform.svg',
					'ever-connect',
					false,
					false,
					13
				]
			);
			const integration = (await tx.query(
				`SELECT ${q('id')} AS ${q('id')} FROM ${q('integration')} WHERE ${q('name')} = ${ph(1)}`,
				[LINK_INTEGRATION_NAME]
			)) as Array<{
				id: string;
			}>;
			const integrationId = integration[0]?.id;
			if (!integrationId) return;
			for (const typeName of INTEGRATION_TYPES) {
				const types = (await tx.query(
					`SELECT ${q('id')} AS ${q('id')} FROM ${q('integration_type')} WHERE ${q('name')} = ${ph(1)}`,
					[typeName]
				)) as Array<{ id: string }>;
				if (!types[0]?.id) continue;
				const linked = (await tx.query(
					`SELECT COUNT(*) AS ${q('n')} FROM ${q('integration_integration_type')} WHERE ${q('integrationId')} = ${ph(1)} AND ${q('integrationTypeId')} = ${ph(2)}`,
					[integrationId, types[0].id]
				)) as Array<{ n: unknown }>;
				if (Number(linked[0]?.n ?? 0) === 0) {
					await tx.query(
						insertIgnore('integration_integration_type', ['integrationId', 'integrationTypeId']),
						[integrationId, types[0].id]
					);
				}
			}
		});
	}
}
