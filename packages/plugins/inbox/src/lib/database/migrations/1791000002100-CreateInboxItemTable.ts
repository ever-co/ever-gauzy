import { MigrationInterface, QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	baseIndexes,
	createIndexIfMissing,
	dialectOf,
	dropTableIfExists,
	InboxDialect,
	IndexSpec,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../migration-helpers';

const TABLE = 'inbox_item';
const PREFIX = 'inbox_item';

/** The item's own columns, after the base columns, per dialect. */
export function inboxItemColumns(d: InboxDialect): string {
	const varchar = (n: number) => (d === 'postgres' ? `character varying(${n})` : `varchar(${n})`);
	const uuid = d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar';
	const ts = d === 'postgres' ? 'TIMESTAMP' : 'datetime';
	const bool = d === 'mysql' ? 'tinyint' : 'boolean';
	const falsy = d === 'postgres' ? 'DEFAULT false' : d === 'mysql' ? 'DEFAULT 0' : 'DEFAULT (0)';
	const nul = d === 'mysql' ? ' NULL' : '';
	const def = (value: string) => (d === 'sqlite' ? `DEFAULT ('${value}')` : `DEFAULT '${value}'`);
	const c = (name: string) => q(d, name);
	return [
		`${c('kind')} ${varchar(16)} NOT NULL`,
		`${c('source')} ${varchar(32)} NOT NULL`,
		`${c('status')} ${varchar(16)} NOT NULL ${def('OPEN')}`,
		`${c('title')} ${varchar(300)} NOT NULL`,
		`${c('body')} text${nul}`,
		`${c('bodyFormat')} ${varchar(16)} NOT NULL ${def('plain')}`,
		`${c('options')} text${nul}`,
		`${c('requireReason')} ${bool} NOT NULL ${falsy}`,
		`${c('response')} text${nul}`,
		`${c('priority')} ${varchar(16)} NOT NULL ${def('normal')}`,
		`${c('dueAt')} ${ts}${nul}`,
		`${c('entity')} ${varchar(64)}${nul}`,
		`${c('entityId')} ${uuid}${nul}`,
		`${c('taskId')} ${uuid}${nul}`,
		`${c('projectId')} ${uuid}${nul}`,
		`${c('agentEmployeeId')} ${uuid}${nul}`,
		`${c('mailboxId')} ${uuid}${nul}`,
		`${c('emailId')} ${uuid}${nul}`,
		`${c('externalSource')} ${varchar(64)}${nul}`,
		`${c('externalId')} ${varchar(255)}${nul}`,
		`${c('metadata')} text${nul}`
	].join(', ');
}

/**
 * The item's indexes. The external identity is unique per tenant; the index is a plain unique index on the
 * three dialects, because all three treat NULLs as distinct in it — every item without a source identity
 * (`externalSource IS NULL`) is allowed, which is the partial uniqueness plan 04 §2 asks for.
 */
export const INBOX_ITEM_INDEXES: IndexSpec[] = [
	...baseIndexes(PREFIX),
	{ name: `IDX_${PREFIX}_kind`, columns: ['kind'] },
	{ name: `IDX_${PREFIX}_source`, columns: ['source'] },
	{ name: `IDX_${PREFIX}_status`, columns: ['status'] },
	{ name: `IDX_${PREFIX}_task`, columns: ['taskId'] },
	{ name: `IDX_${PREFIX}_project`, columns: ['projectId'] },
	{ name: `IDX_${PREFIX}_agent_employee`, columns: ['agentEmployeeId'] },
	{ name: `IDX_${PREFIX}_created_at`, columns: ['createdAt'] },
	{ name: `UQ_${PREFIX}_external`, columns: ['tenantId', 'externalSource', 'externalId'], unique: true }
];

/**
 * `inbox_item` (plan 04 §2, G-P3-1): the questions, approvals, escalations and notices addressed to users.
 *
 * A plugin migration: it is registered only where `GAUZY_INBOX_ENABLED=true` loads the plugin, so an
 * installation that has not switched the Inbox on never gets the table. Idempotent on every dialect
 * (`IF NOT EXISTS` and probes; a re-run issues no DDL, and repairs an index or key a failed run left out),
 * serialised on Postgres with an advisory lock, and reversible (`down` drops the table).
 */
export class CreateInboxItemTable1791000002100 implements MigrationInterface {
	name = 'CreateInboxItemTable1791000002100';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxItemColumns(d)}, CONSTRAINT "PK_${PREFIX}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${baseColumns(d)}, ${inboxItemColumns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${inboxItemColumns(d)}, ${sqliteForeignKeys(PREFIX)})`
			);
		}
		for (const index of INBOX_ITEM_INDEXES) {
			await createIndexIfMissing(queryRunner, TABLE, index);
		}
		for (const fk of baseForeignKeys(PREFIX)) {
			await addForeignKeyIfMissing(queryRunner, TABLE, fk);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await lockMigrations(queryRunner);
		await dropTableIfExists(queryRunner, TABLE);
	}
}
