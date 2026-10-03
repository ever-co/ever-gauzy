import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** A column: name, type per database, and whether it may be empty / its default. */
interface Column {
	name: string;
	postgres: string;
	mysql: string;
	sqlite: string;
	notNull?: boolean;
	default?: { postgres: string; mysql: string; sqlite: string };
}

/** A table: its columns (the first is the primary key) and its indexes. */
interface Table {
	name: string;
	columns: Column[];
	indexes: Array<{ name: string; columns: string[]; unique?: boolean }>;
}

const varchar = (name: string, length: number, notNull = false): Column => ({
	name,
	postgres: `character varying(${length})`,
	mysql: `varchar(${length})`,
	sqlite: `varchar(${length})`,
	notNull
});
const bigint = (name: string, notNull = false): Column => ({
	name,
	postgres: 'bigint',
	mysql: 'bigint',
	sqlite: 'bigint',
	notNull
});
const text = (name: string): Column => ({ name, postgres: 'text', mysql: 'text', sqlite: 'text' });
const integer = (name: string, defaultValue?: number): Column => ({
	name,
	postgres: 'integer',
	mysql: 'int',
	sqlite: 'integer',
	notNull: defaultValue !== undefined,
	default:
		defaultValue === undefined
			? undefined
			: { postgres: `${defaultValue}`, mysql: `${defaultValue}`, sqlite: `(${defaultValue})` }
});
const bool = (name: string, defaultValue?: boolean): Column => ({
	name,
	postgres: 'boolean',
	mysql: 'tinyint',
	sqlite: 'boolean',
	notNull: true,
	default:
		defaultValue === undefined
			? undefined
			: {
					postgres: defaultValue ? 'true' : 'false',
					mysql: defaultValue ? '1' : '0',
					sqlite: defaultValue ? '(1)' : '(0)'
				}
});

/**
 * The tables of the Ever Platform connection plugin (`@gauzy/plugin-ever-connect`). Times are epoch
 * milliseconds; ids are text (Ever Platform ids are ULIDs).
 */
const TABLES: Table[] = [
	{
		name: 'ever_connect_connection',
		columns: [
			varchar('id', 16, true),
			varchar('platformInstanceId', 32),
			varchar('kid', 16),
			varchar('ownerOrgId', 32),
			varchar('ownerHandle', 64),
			varchar('apiUrl', 255),
			varchar('publicUrl', 255),
			varchar('status', 24, true),
			bigint('connectedAt'),
			varchar('connectedByUserId', 36),
			bigint('lastHeartbeatAt'),
			bigint('nextHeartbeatAt'),
			varchar('leasedBy', 64),
			bigint('leaseUntil'),
			varchar('feedCursor', 64),
			varchar('envCodeConsumedHash', 64),
			integer('envCodeAttempts', 0),
			bigint('envCodeNextAttemptAt'),
			varchar('lastError', 255),
			bigint('revokedAt'),
			text('instanceEntitlementJwsEncrypted'),
			bigint('instanceEntitlementSeq'),
			bigint('instanceEntitlementIat'),
			bigint('instanceEntitlementExp'),
			bigint('instanceEntitlementFetchedAt'),
			bigint('createdAt', true),
			bigint('updatedAt', true)
		],
		indexes: []
	},
	{
		name: 'ever_connect_link',
		columns: [
			varchar('id', 36, true),
			varchar('tenantId', 36, true),
			varchar('organizationId', 36, true),
			varchar('integrationTenantId', 36),
			varchar('linkId', 32, true),
			varchar('everOrgId', 32, true),
			varchar('everHandle', 64),
			varchar('status', 16, true),
			text('entitlementJwsEncrypted'),
			bigint('entitlementSeq'),
			bigint('entitlementIat'),
			bigint('entitlementExp'),
			bigint('entitlementFetchedAt'),
			varchar('linkedByUserId', 36),
			bigint('createdAt', true),
			bigint('updatedAt', true),
			bigint('unlinkedAt')
		],
		indexes: [
			{ name: 'IDX_ever_connect_link_organization', columns: ['tenantId', 'organizationId'] },
			{ name: 'IDX_ever_connect_link_link_id', columns: ['linkId'], unique: true }
		]
	},
	{
		name: 'ever_connect_integration',
		columns: [
			varchar('id', 36, true),
			varchar('scope', 40, true),
			varchar('name', 64, true),
			varchar('tenantId', 36),
			varchar('organizationId', 36),
			varchar('integrationTenantId', 36),
			integer('scopeVersion'),
			bool('enabled', false),
			varchar('state', 24, true),
			varchar('operatorAccept', 16),
			varchar('consentId', 32),
			bigint('consentedAt'),
			varchar('consentedByLabel', 64),
			varchar('consentSource', 24),
			varchar('termsVersion', 32),
			varchar('dpaVersion', 32),
			bigint('revokedAt'),
			varchar('revokeSource', 16),
			bool('pendingRemoteRevoke', false),
			text('configEncrypted'),
			bigint('createdAt', true),
			bigint('updatedAt', true)
		],
		indexes: [
			{ name: 'IDX_ever_connect_integration_scope_name', columns: ['scope', 'name'], unique: true },
			{ name: 'IDX_ever_connect_integration_organization', columns: ['tenantId', 'organizationId'] }
		]
	},
	{
		name: 'ever_connect_policy',
		columns: [
			varchar('integration', 64, true),
			bool('allowed'),
			varchar('source', 16, true),
			varchar('changedByUserId', 36),
			bigint('changedAt', true)
		],
		indexes: []
	},
	{
		name: 'ever_connect_audit',
		columns: [
			varchar('id', 36, true),
			bigint('at', true),
			varchar('tenantId', 36),
			varchar('organizationId', 36),
			varchar('actorUserId', 36),
			varchar('actorLabel', 64, true),
			varchar('action', 48, true),
			varchar('integration', 64),
			text('details')
		],
		indexes: [
			{ name: 'IDX_ever_connect_audit_organization_at', columns: ['tenantId', 'organizationId', 'at'] },
			{ name: 'IDX_ever_connect_audit_at', columns: ['at'] }
		]
	},
	{
		name: 'ever_connect_lookup_cache',
		columns: [
			varchar('id', 36, true),
			varchar('tenantId', 36),
			varchar('organizationId', 36, true),
			varchar('kind', 16, true),
			varchar('hash', 64, true),
			varchar('saltVersion', 32, true),
			text('result'),
			bigint('expiresAt', true)
		],
		indexes: [
			{ name: 'IDX_ever_connect_lookup_cache_key', columns: ['organizationId', 'kind', 'hash'], unique: true }
		]
	}
];

/**
 * Creates the six tables of the Ever Platform connection plugin (`@gauzy/plugin-ever-connect`):
 *
 * - `ever_connect_connection`: the one-row connection of this installation (no credential: the
 *   connect key lives encrypted in `ever_instance`; the instance-wide entitlement document is
 *   stored encrypted);
 * - `ever_connect_link`: one row per Gauzy organization linked to an Ever organization (its
 *   entitlement document, encrypted; Gauzy's own `integration_tenant` row names the link);
 * - `ever_connect_integration`: the local state of each integration, per link or installation-wide;
 * - `ever_connect_policy`: the operator's allow or deny per integration;
 * - `ever_connect_audit`: the append-only record of what happened (ids and states only);
 * - `ever_connect_lookup_cache`: reserved for the counterparty check (empty in this release).
 *
 * The migration lives in core because plugins cannot carry migrations yet; the plugin's
 * `MIGRATIONS.md` lists it. The tables exist whether or not the plugin is loaded; nothing reads
 * them when it is not.
 *
 * Safe to run on a live database: it creates six new, empty tables and their indexes, and changes
 * nothing else. No foreign key, so no lock on an existing table; no statement per tenant or per
 * row. Every statement is `IF NOT EXISTS`, so running `up` twice is harmless. On Postgres a
 * transaction-scoped advisory lock serialises two API processes that boot at the same time.
 *
 * `down` drops the six tables (and their indexes with them).
 */
export class EverConnect1790000021200 implements MigrationInterface {
	name = 'EverConnect1790000021200';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000021200;

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const tables = [...TABLES].reverse().map((table) => table.name);
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				for (const table of tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				for (const table of tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
				}
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		for (const table of TABLES) {
			const columns = table.columns.map((column) => {
				const nullability = column.notNull ? ' NOT NULL' : '';
				const fallback = column.default ? ` DEFAULT ${column.default.postgres}` : '';
				return `"${column.name}" ${column.postgres}${nullability}${fallback}`;
			});
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${table.name}" (${columns.join(', ')}, CONSTRAINT "PK_${table.name}" PRIMARY KEY ("${table.columns[0].name}"))`
			);
			for (const index of table.indexes) {
				await queryRunner.query(
					`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" (${index.columns.map((c) => `"${c}"`).join(', ')})`
				);
			}
		}
	}

	/**
	 * MySQL Up Migration (MySQL has no `CREATE INDEX IF NOT EXISTS`: the indexes are part of the table).
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const table of TABLES) {
			const columns = table.columns.map((column) => {
				const nullability = column.notNull ? ' NOT NULL' : ' NULL';
				const fallback = column.default ? ` DEFAULT ${column.default.mysql}` : '';
				return `\`${column.name}\` ${column.mysql}${nullability}${fallback}`;
			});
			const indexes = table.indexes.map(
				(index) =>
					`${index.unique ? 'UNIQUE ' : ''}INDEX \`${index.name}\` (${index.columns.map((c) => `\`${c}\``).join(', ')})`
			);
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${table.name}\` (${[...columns, ...indexes, `PRIMARY KEY (\`${table.columns[0].name}\`)`].join(', ')}) ENGINE=InnoDB`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const table of TABLES) {
			const columns = table.columns.map((column, at) => {
				const key = at === 0 ? ' PRIMARY KEY' : '';
				const nullability = column.notNull ? ' NOT NULL' : '';
				const fallback = column.default ? ` DEFAULT ${column.default.sqlite}` : '';
				return `"${column.name}" ${column.sqlite}${key}${nullability}${fallback}`;
			});
			await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${columns.join(', ')})`);
			for (const index of table.indexes) {
				await queryRunner.query(
					`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" (${index.columns.map((c) => `"${c}"`).join(', ')})`
				);
			}
		}
	}
}
