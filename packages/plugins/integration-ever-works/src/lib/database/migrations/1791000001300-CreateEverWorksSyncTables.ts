import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	baseIndexes,
	createIndexIfMissing,
	dialectOf,
	dropTableIfExists,
	EverWorksDialect,
	IndexSpec,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../migration-helpers';

type Column = [name: string, type: (d: EverWorksDialect) => string, notNull?: boolean, def?: string];

const varchar = (n: number) => (d: EverWorksDialect) => (d === 'postgres' ? `character varying(${n})` : `varchar(${n})`);
const text = () => 'text';
const int = (d: EverWorksDialect) => (d === 'mysql' ? 'int' : 'integer');
const bigint = (d: EverWorksDialect) => (d === 'sqlite' ? 'integer' : 'bigint');
const ts = (d: EverWorksDialect) => (d === 'postgres' ? 'TIMESTAMP' : 'datetime');

/** The four sync tables (plan 03 §C.1) and the connection's lease and resync columns. */
const TABLES: Record<string, { prefix: string; columns: Column[]; indexes: IndexSpec[] }> = {
	ever_works_entity_link: {
		prefix: 'ever_works_entity_link',
		columns: [
			['integrationTenantId', varchar(36), true],
			['entityType', varchar(32), true],
			['gauzyId', varchar(36), true],
			['ewId', varchar(64), true],
			['ewVersion', int],
			['ewUpdatedAt', ts],
			['gauzyUpdatedAt', ts],
			['snapshot', text],
			['ewOnly', text],
			['lastDirection', varchar(16)],
			['lastSyncedAt', ts],
			['state', varchar(16), true, 'ok'],
			['lastError', text]
		],
		indexes: [
			{ name: 'IDX_ever_works_entity_link_integration', columns: ['integrationTenantId'] },
			{ name: 'IDX_ever_works_entity_link_state', columns: ['state'] },
			{ name: 'UQ_ever_works_entity_link_ew', columns: ['integrationTenantId', 'entityType', 'ewId'], unique: true },
			{ name: 'UQ_ever_works_entity_link_gauzy', columns: ['integrationTenantId', 'entityType', 'gauzyId'], unique: true }
		]
	},
	ever_works_inbound_event: {
		prefix: 'ever_works_inbound_event',
		columns: [
			['connectionId', varchar(36), true],
			['eventId', varchar(64), true],
			['seq', bigint, true],
			['type', varchar(64), true],
			['aggregateType', varchar(32), true],
			['aggregateId', varchar(64), true],
			['aggregateVersion', int],
			['ewOrganizationId', varchar(64)],
			['payload', text, true],
			['receivedVia', varchar(16), true],
			['status', varchar(16), true, 'pending'],
			['attempts', int, true, '0'],
			['availableAt', ts],
			['error', text],
			['appliedAt', ts]
		],
		indexes: [
			{ name: 'UQ_ever_works_inbound_event_event', columns: ['connectionId', 'eventId'], unique: true },
			{ name: 'IDX_ever_works_inbound_event_work', columns: ['connectionId', 'status', 'availableAt'] },
			{ name: 'IDX_ever_works_inbound_event_aggregate', columns: ['connectionId', 'aggregateType', 'aggregateId', 'seq'] },
			{ name: 'IDX_ever_works_inbound_event_status', columns: ['status'] }
		]
	},
	ever_works_outbound_change: {
		prefix: 'ever_works_outbound_change',
		columns: [
			['integrationTenantId', varchar(36), true],
			['entityType', varchar(32), true],
			['gauzyId', varchar(36), true],
			['op', varchar(8), true, 'upsert'],
			['changedFieldsHint', text],
			['actorUserId', varchar(36)],
			['status', varchar(16), true, 'pending'],
			['attempts', int, true, '0'],
			['availableAt', ts],
			['lastError', text]
		],
		indexes: [
			{ name: 'IDX_ever_works_outbound_change_work', columns: ['integrationTenantId', 'status', 'availableAt'] },
			{ name: 'IDX_ever_works_outbound_change_status', columns: ['status'] },
			{
				// Coalescing: one pending change per record (MySQL keeps it with the service's row lock).
				name: 'UQ_ever_works_outbound_change_pending',
				columns: ['integrationTenantId', 'entityType', 'gauzyId'],
				unique: true,
				where: { postgres: `"status" = 'pending'`, sqlite: `"status" = 'pending'` }
			}
		]
	},
	ever_works_sync_log: {
		prefix: 'ever_works_sync_log',
		columns: [
			['integrationTenantId', varchar(36)],
			['connectionId', varchar(36)],
			['direction', varchar(16), true],
			['entityType', varchar(32)],
			['gauzyId', varchar(36)],
			['ewId', varchar(64)],
			['action', varchar(64), true],
			['status', varchar(16), true],
			['message', text],
			['details', text],
			['resolvedByUserId', varchar(36)],
			['resolvedAt', ts]
		],
		indexes: [
			{ name: 'IDX_ever_works_sync_log_integration', columns: ['integrationTenantId', 'createdAt'] },
			{ name: 'IDX_ever_works_sync_log_status', columns: ['status'] }
		]
	}
};

/** Columns added to `ever_works_connection` for the sync loop. */
const CONNECTION_COLUMNS: Column[] = [
	['leaseOwner', varchar(64)],
	['leaseUntil', ts],
	['lastFeedPollAt', ts],
	['lastWebhookAt', ts],
	['resyncRequestedAt', ts]
];

function columnSql(d: EverWorksDialect, [name, type, notNull, def]: Column): string {
	const nullable = notNull ? ' NOT NULL' : d === 'mysql' ? ' NULL' : '';
	const isNumber = def !== undefined && /^\d+$/.test(def);
	const defaultSql = def === undefined ? '' : d === 'sqlite' ? ` DEFAULT (${isNumber ? def : `'${def}'`})` : ` DEFAULT ${isNumber ? def : `'${def}'`}`;
	return `${q(d, name)} ${type(d)}${nullable}${defaultSql}`;
}

/**
 * The sync engine's tables (plan 03 §C.1, G-P1-5): `ever_works_entity_link`, `ever_works_inbound_event`,
 * `ever_works_outbound_change`, `ever_works_sync_log`, plus the lease and resync columns of
 * `ever_works_connection`. A plugin migration (registered only where `EVER_WORKS_ENABLED=true`),
 * idempotent on Postgres, SQLite and MySQL, serialised on Postgres, and reversible.
 */
export class CreateEverWorksSyncTables1791000001300 implements MigrationInterface {
	name = 'CreateEverWorksSyncTables1791000001300';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		for (const [table, def] of Object.entries(TABLES)) {
			const columns = def.columns.map((column) => columnSql(d, column)).join(', ');
			if (d === 'postgres') {
				await queryRunner.query(
					`CREATE TABLE IF NOT EXISTS "${table}" (${baseColumns(d)}, ${columns}, CONSTRAINT "PK_${def.prefix}" PRIMARY KEY ("id"))`
				);
			} else if (d === 'mysql') {
				await queryRunner.query(`CREATE TABLE IF NOT EXISTS \`${table}\` (${baseColumns(d)}, ${columns}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
			} else {
				await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table}" (${baseColumns(d)}, ${columns}, ${sqliteForeignKeys(def.prefix)})`);
			}
			for (const index of [...baseIndexes(def.prefix), ...def.indexes]) {
				await createIndexIfMissing(queryRunner, table, index);
			}
			for (const fk of baseForeignKeys(def.prefix)) {
				await addForeignKeyIfMissing(queryRunner, table, fk);
			}
		}
		if (await queryRunner.hasTable('ever_works_connection')) {
			for (const column of CONNECTION_COLUMNS) {
				if (!(await queryRunner.hasColumn('ever_works_connection', column[0]))) {
					await queryRunner.query(`ALTER TABLE ${q(d, 'ever_works_connection')} ADD ${columnSql(d, column)}`);
				}
			}
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		for (const table of Object.keys(TABLES).reverse()) {
			await dropTableIfExists(queryRunner, table);
		}
		if (await queryRunner.hasTable('ever_works_connection')) {
			for (const column of [...CONNECTION_COLUMNS].reverse()) {
				if (await queryRunner.hasColumn('ever_works_connection', column[0])) {
					await queryRunner.query(`ALTER TABLE ${q(d, 'ever_works_connection')} DROP COLUMN ${q(d, column[0])}`);
				}
			}
		}
	}
}
