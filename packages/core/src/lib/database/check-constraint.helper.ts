import { QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * The rule most of this programme's migrations carry, in one place.
 *
 * A `CHECK` is the one constraint kind a migration cannot add with a single portable statement, and the
 * shape every constraint migration in this programme ended up writing by hand was the same four probes
 * around two dialect statements: the table has to exist, every column the rule reads has to exist, the
 * constraint must not already be there, and the embedded dialect cannot add a `CHECK` to an existing
 * table at all and therefore skips the whole thing. Written per migration, those probes are four places
 * to get it wrong, and the one that matters — the column probe — is the one a reader cannot see is
 * missing: a rule that reads a column the table does not have is a migration that runs on every
 * installation and constrains nothing.
 *
 * So the probes live here, and a migration states what it is adding rather than how to add it safely:
 * the table, the constraint's name, the columns the rule reads, and the rule in each dialect that
 * enforces it. That is also what makes the deferral visible: a migration whose columns are not there yet
 * reports that it skipped, by name and by column, instead of appearing to have run.
 *
 * **Why the dialect statements are passed in rather than generated.** A `CHECK` is the one statement
 * whose body a generator cannot write: a predicate is a domain rule, and the two dialects differ in
 * quote characters, boolean handling and — for MySQL before 8.0.16 — whether the rule is enforced at all.
 * Each migration therefore carries its own two statements, and this helper decides which one a
 * connection gets and whether it may run.
 */

/** One rule a migration wants the database to carry. */
export interface ICheckConstraintDefinition {
	/** The table the rule is attached to. */
	readonly table: string;
	/** The constraint's name, `CHK_<table>_<semantic>` by the platform's naming doctrine. */
	readonly name: string;
	/**
	 * Every column the rule reads.
	 *
	 * All of them are probed: a rule about a column the table does not have cannot be created, and a
	 * migration that says so is better than one that appears to have added it.
	 */
	readonly columns: readonly string[];
	/** The rule, as the PostgreSQL `ALTER TABLE` that adds it. */
	readonly postgres: string;
	/** The same rule, as the MySQL `ALTER TABLE` that adds it (back-quoted). */
	readonly mysql: string;
}

/** What adding a rule did. */
export type TCheckConstraintOutcome = 'added' | 'present' | 'unsupported' | 'not-ready';

/**
 * Whether the connection's dialect can add a `CHECK` to a table it did not just create.
 *
 * SQLite parses neither `ALTER TABLE … ADD CONSTRAINT` nor a constraint added to an existing table: the
 * only way to give an existing SQLite table a rule is to rebuild it, which is not something a migration
 * does behind a caller's back. The dialect's branch is therefore an explicit, documented no-op, and the
 * rule there rests on the write path and on the nightly audit — the fallback §1.7 of the schema chapter
 * states for every constraint this dialect cannot carry.
 *
 * @param queryRunner The runner the migration is executing on.
 * @returns Whether the dialect can enforce a check constraint added to an existing table.
 */
export function supportsCheckConstraints(queryRunner: QueryRunner): boolean {
	const type = queryRunner.connection.options.type as DatabaseTypeEnum;

	return type === DatabaseTypeEnum.postgres || type === DatabaseTypeEnum.mysql;
}

/**
 * Whether a table already carries a constraint of a given name.
 *
 * Read through the table metadata first. TypeORM's MySQL runner does not load `CHECK` constraints, so its
 * description never lists one: on MySQL a name the metadata does not list is looked up in
 * `information_schema.TABLE_CONSTRAINTS`, otherwise a down step never drops the rule and a re-run adds it a
 * second time, which MySQL refuses (3822).
 *
 * @param queryRunner The runner the migration is executing on.
 * @param table The table to describe.
 * @param name The constraint name.
 * @returns Whether the constraint is already there. A table that cannot be described answers `true`, so
 * a migration never adds a constraint to a table it could not read.
 */
export async function hasCheckConstraint(
	queryRunner: QueryRunner,
	table: string,
	name: string
): Promise<boolean> {
	try {
		const described = await queryRunner.getTable(table);

		if (described?.checks?.some((check) => check.name === name)) {
			return true;
		}

		if ((queryRunner.connection.options.type as DatabaseTypeEnum) !== DatabaseTypeEnum.mysql) {
			return false;
		}

		const rows: Array<{ name: string }> = await queryRunner.query(
			`SELECT CONSTRAINT_NAME AS name FROM information_schema.TABLE_CONSTRAINTS ` +
				`WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'CHECK'`,
			[table, name]
		);

		return Array.isArray(rows) && rows.some((row) => row?.name === name);
	} catch {
		return true;
	}
}

/**
 * Adds one rule, when the table, the columns it reads and its own absence all allow it.
 *
 * @param queryRunner The runner the migration is executing on.
 * @param definition The table, the constraint's name, the columns it reads and its two statements.
 * @param migrationName The migration doing the adding, named in the log.
 * @returns What happened, so a migration can report it: `added`, `present` (already there),
 * `unsupported` (the dialect cannot add one), or `not-ready` (the table or a column is absent).
 */
export async function addCheckConstraint(
	queryRunner: QueryRunner,
	definition: ICheckConstraintDefinition,
	migrationName: string
): Promise<TCheckConstraintOutcome> {
	if (!supportsCheckConstraints(queryRunner)) {
		console.log(
			chalk.yellow(
				`${migrationName}: ${queryRunner.connection.options.type} cannot add a constraint to an existing table, so ${definition.name} is not created; the rule rests on the write path and the nightly audit.`
			)
		);

		return 'unsupported';
	}

	if (!(await queryRunner.hasTable(definition.table))) {
		return 'not-ready';
	}

	for (const column of definition.columns) {
		if (!(await queryRunner.hasColumn(definition.table, column))) {
			console.log(
				chalk.yellow(
					`${migrationName}: ${definition.table} carries no "${column}" column, so ${definition.name} has nothing to constrain and is not created.`
				)
			);

			return 'not-ready';
		}
	}

	if (await hasCheckConstraint(queryRunner, definition.table, definition.name)) {
		return 'present';
	}

	const type = queryRunner.connection.options.type as DatabaseTypeEnum;

	if (type === DatabaseTypeEnum.mysql) {
		const foreignKey = await modifyingForeignKeyOn(queryRunner, definition.table, definition.columns);

		if (foreignKey) {
			console.log(
				chalk.yellow(
					`${migrationName}: MySQL refuses a CHECK over a column a foreign-key action rewrites (${foreignKey} on ${definition.table}), so ${definition.name} is not created; the rule rests on the write path and the nightly audit.`
				)
			);

			return 'unsupported';
		}
	}

	await queryRunner.query(type === DatabaseTypeEnum.mysql ? definition.mysql : definition.postgres);
	console.log(chalk.yellow(`${migrationName}: added ${definition.name} on ${definition.table}.`));

	return 'added';
}

/**
 * Drops one rule, when the dialect can and the constraint is there.
 *
 * @param queryRunner The runner the migration is executing on.
 * @param definition The table and the constraint's name.
 * @returns Whether a constraint was dropped.
 */
export async function dropCheckConstraint(
	queryRunner: QueryRunner,
	definition: Pick<ICheckConstraintDefinition, 'table' | 'name'>
): Promise<boolean> {
	if (!supportsCheckConstraints(queryRunner)) {
		return false;
	}

	if (!(await hasCheckConstraint(queryRunner, definition.table, definition.name))) {
		return false;
	}

	const type = queryRunner.connection.options.type as DatabaseTypeEnum;
	const statement =
		type === DatabaseTypeEnum.mysql
			? `ALTER TABLE \`${definition.table}\` DROP CONSTRAINT \`${definition.name}\``
			: `ALTER TABLE "${definition.table}" DROP CONSTRAINT "${definition.name}"`;

	try {
		await queryRunner.query(statement);
	} catch (error) {
		const failure = error as { code?: string; driverError?: { code?: string } };

		// MySQL 8.0.16 to 8.0.18 enforce a CHECK but only parse `DROP CHECK`; `DROP CONSTRAINT` came in 8.0.19.
		if (type !== DatabaseTypeEnum.mysql || (failure?.code ?? failure?.driverError?.code) !== 'ER_PARSE_ERROR') {
			throw error;
		}

		await queryRunner.query(`ALTER TABLE \`${definition.table}\` DROP CHECK \`${definition.name}\``);
	}

	return true;
}

/**
 * The foreign key whose referential action rewrites one of the columns a rule reads, on MySQL.
 *
 * MySQL ≥ 8.0.16 refuses a `CHECK` over a column that a foreign key's action modifies — `ON DELETE SET NULL` /
 * `SET DEFAULT`, or any `ON UPDATE` action other than `RESTRICT` / `NO ACTION` — with `3823 … needed in a foreign
 * key constraint … referential action`. `ON DELETE CASCADE` removes the row rather than rewriting the column, so it
 * does not count. Adding such a rule anyway stopped every MySQL installation at the migration that tried (review
 * R5-11: `CHK_adjustment_funding`, `CHK_promotion_seller_funding` over a seller reference that is `SET NULL`).
 *
 * @param queryRunner The migration's runner, on MySQL.
 * @param table The table the rule is about.
 * @param columns The columns the rule reads.
 * @returns The name of the first such foreign key, or undefined when there is none.
 */
export async function modifyingForeignKeyOn(
	queryRunner: QueryRunner,
	table: string,
	columns: readonly string[]
): Promise<string | undefined> {
	if (!columns.length) {
		return undefined;
	}

	const rows: Array<{ name: string }> = await queryRunner.query(
		`SELECT k.CONSTRAINT_NAME AS name FROM information_schema.KEY_COLUMN_USAGE k ` +
			`JOIN information_schema.REFERENTIAL_CONSTRAINTS r ` +
			`ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME ` +
			`WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? AND k.COLUMN_NAME IN (${columns.map(() => '?').join(', ')}) ` +
			`AND (r.DELETE_RULE IN ('SET NULL', 'SET DEFAULT') OR r.UPDATE_RULE IN ('SET NULL', 'SET DEFAULT', 'CASCADE')) ` +
			`LIMIT 1`,
		[table, ...columns]
	);

	return rows?.[0]?.name;
}
