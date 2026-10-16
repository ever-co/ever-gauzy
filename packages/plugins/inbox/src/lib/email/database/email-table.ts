import { QueryRunner } from 'typeorm';
import {
	addForeignKeyIfMissing,
	baseColumns,
	baseForeignKeys,
	createIndexIfMissing,
	dialectOf,
	InboxDialect,
	IndexSpec,
	lockMigrations,
	q,
	sqliteForeignKeys
} from '../../database/migration-helpers';

/** A foreign key of an email table (beyond the tenant / organization keys every table gets). */
export interface EmailTableForeignKey {
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE' | 'SET NULL';
}

/** One email table: its own columns per dialect, its indexes and its own foreign keys. */
export interface EmailTableSpec {
	table: string;
	/** The index / key name prefix. */
	prefix: string;
	columns: (dialect: InboxDialect) => string;
	indexes: IndexSpec[];
	foreignKeys?: EmailTableForeignKey[];
}

/** The column type spellings of a dialect, as the inbox item migrations write them. */
export function columnTypes(d: InboxDialect) {
	return {
		varchar: (n: number) => (d === 'postgres' ? `character varying(${n})` : `varchar(${n})`),
		uuid: d === 'postgres' ? 'uuid' : d === 'mysql' ? 'varchar(36)' : 'varchar',
		ts: d === 'postgres' ? 'TIMESTAMP' : 'datetime',
		bool: d === 'mysql' ? 'tinyint' : 'boolean',
		int: d === 'postgres' ? 'integer' : d === 'mysql' ? 'int' : 'integer',
		bigint: d === 'postgres' ? 'bigint' : d === 'mysql' ? 'bigint' : 'integer',
		float: d === 'postgres' ? 'double precision' : d === 'mysql' ? 'double' : 'real',
		/** MySQL `text` stops at 64 KB; a message body or a sanitized HTML part can be larger. */
		longText: d === 'mysql' ? 'longtext' : 'text',
		falsy: d === 'postgres' ? 'DEFAULT false' : d === 'mysql' ? 'DEFAULT 0' : 'DEFAULT (0)',
		zero: d === 'sqlite' ? 'DEFAULT (0)' : 'DEFAULT 0',
		nul: d === 'mysql' ? ' NULL' : '',
		def: (value: string) => (d === 'sqlite' ? `DEFAULT ('${value}')` : `DEFAULT '${value}'`),
		c: (name: string) => q(d, name)
	};
}

/**
 * Creates an email table the way the inbox item migrations do: `IF NOT EXISTS`, then each index and key when it is
 * missing (a re-run issues no DDL and repairs what a failed run left out), serialised on Postgres.
 */
export async function createEmailTable(queryRunner: QueryRunner, spec: EmailTableSpec): Promise<void> {
	const d = dialectOf(queryRunner);
	await lockMigrations(queryRunner);
	const own = spec.foreignKeys ?? [];
	if (d === 'postgres') {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${spec.table}" (${baseColumns(d)}, ${spec.columns(d)}, CONSTRAINT "PK_${spec.prefix}" PRIMARY KEY ("id"))`
		);
	} else if (d === 'mysql') {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${spec.table}\` (${baseColumns(d)}, ${spec.columns(d)}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
	} else {
		const inline = own
			.map(
				(fk) =>
					`, CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE NO ACTION`
			)
			.join('');
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${spec.table}" (${baseColumns(d)}, ${spec.columns(d)}, ${sqliteForeignKeys(spec.prefix)}${inline})`
		);
	}
	for (const index of spec.indexes) {
		await createIndexIfMissing(queryRunner, spec.table, index);
	}
	for (const fk of [...baseForeignKeys(spec.prefix), ...own]) {
		await addForeignKeyIfMissing(queryRunner, spec.table, fk);
	}
}
