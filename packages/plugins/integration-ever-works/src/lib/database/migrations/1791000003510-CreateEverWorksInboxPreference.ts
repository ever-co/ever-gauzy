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

type Column = [name: string, type: (d: EverWorksDialect) => string, notNull?: boolean];

const varchar = (n: number) => (d: EverWorksDialect) => (d === 'postgres' ? `character varying(${n})` : `varchar(${n})`);
const text = () => 'text';

const TABLE = 'ever_works_inbox_preference';
const PREFIX = 'ever_works_inbox_preference';

const COLUMNS: Column[] = [
	['userId', varchar(36), true],
	['excludedKinds', text]
];

const INDEXES: IndexSpec[] = [
	{ name: 'IDX_ever_works_inbox_preference_user', columns: ['userId'] },
	// One preference per person and tenant.
	{ name: 'UQ_ever_works_inbox_preference_user', columns: ['tenantId', 'userId'], unique: true }
];

function columnSql(d: EverWorksDialect, [name, type, notNull]: Column): string {
	const nullable = notNull ? ' NOT NULL' : d === 'mysql' ? ' NULL' : '';
	return `${q(d, name)} ${type(d)}${nullable}`;
}

/**
 * Each person's choice of what of their Gauzy Inbox goes to Ever Works: `ever_works_inbox_preference` (the kinds
 * they exclude; no row sends everything). A plugin migration (registered only where `EVER_WORKS_ENABLED=true`),
 * idempotent on Postgres, SQLite and MySQL, serialised on Postgres, and reversible. Additive: no existing table
 * changes, and nothing is written into it here.
 */
export class CreateEverWorksInboxPreference1791000003510 implements MigrationInterface {
	name = 'CreateEverWorksInboxPreference1791000003510';

	public async up(queryRunner: QueryRunner): Promise<void> {
		const d = dialectOf(queryRunner);
		await lockMigrations(queryRunner);
		const columns = COLUMNS.map((column) => columnSql(d, column)).join(', ');
		if (d === 'postgres') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${columns}, CONSTRAINT "PK_${PREFIX}" PRIMARY KEY ("id"))`
			);
		} else if (d === 'mysql') {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${baseColumns(d)}, ${columns}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
			);
		} else {
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${TABLE}" (${baseColumns(d)}, ${columns}, ${sqliteForeignKeys(PREFIX)})`
			);
		}
		for (const index of [...baseIndexes(PREFIX), ...INDEXES]) {
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
