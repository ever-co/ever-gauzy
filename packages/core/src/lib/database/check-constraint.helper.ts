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
 * Read through the table metadata rather than through `information_schema`, because that is the one
 * description of a table all three dialects answer through TypeORM, and a migration needs the same answer
 * on each.
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

		return Boolean(described?.checks?.some((check) => check.name === name));
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

	await queryRunner.query(statement);

	return true;
}
