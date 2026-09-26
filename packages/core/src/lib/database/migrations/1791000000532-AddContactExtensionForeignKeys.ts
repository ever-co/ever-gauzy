import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * One guarded reference onto a contact-extension table.
 *
 * `column` is the referencing column, `target` the table it must name, and `constraint` the name the
 * constraint carries in every dialect. `onDelete` is the policy the schema chapter states for this
 * relation kind: an optional reference to a configuration row releases rather than cascades, so the
 * documents that named it survive its removal.
 */
interface ContactReference {
	/** The constraint's name, identical on every dialect that carries it. */
	constraint: string;
	/** The table that carries the referencing column. */
	table: string;
	/** The referencing column. */
	column: string;
	/** The table the column must reference. */
	target: string;
	/** Whether the reference is mandatory for the row to be readable at all. */
	optional: boolean;
}

/**
 * The references onto the four contact-extension tables that the creating migration could not write.
 *
 * Every one of them is a reference **from** a table created by another set **onto** a contact-extension
 * table (or the reverse for the price list, which is the same problem seen from the other side): the
 * target did not exist at tick `1791000000094`, and a migration may only reference a table an earlier
 * migration creates.
 */
const REFERENCES: ContactReference[] = [
	{
		constraint: 'FK_price_list_customer_group',
		table: 'price_list',
		column: 'customerGroupId',
		target: 'contact_group',
		optional: true
	},
	{
		constraint: 'FK_promotion_customer_group',
		table: 'promotion',
		column: 'customerGroupId',
		target: 'contact_group',
		optional: true
	},
	{
		constraint: 'FK_contact_group_price_list',
		table: 'contact_group',
		column: 'priceListId',
		target: 'price_list',
		optional: true
	}
];

/**
 * Adds the foreign keys the four contact-extension tables carry but could not create with themselves.
 *
 * **Why this file exists at all.** A constraint can only be created where both of its ends exist, and
 * the kernel's own rule is that a migration never waits for a package to be installed. Three references
 * fail that test from one side or the other, and each is left without its constraint by the migration
 * that creates its table:
 *
 * 1. `price_list.customerGroupId` → `contact_group` (the pricing capability's set, written against a
 *    target the kernel had never created: on the installations that ran it, the statement had nothing to
 *    reference).
 * 2. `promotion.customerGroupId` → `contact_group` (the promotion capability's set, the same).
 * 3. `contact_group.priceListId` → `price_list` (the kernel's own set, which deliberately does not wait
 *    for the pricing capability: the column is created and its constraint is added here, once the table
 *    exists — the platform's rule that a constraint is added where its target is created).
 *
 * **The tick.** `1791000000532` sits above the pricing set (`…120`), the promotion set (`…260`) and the
 * creating migration (`…094`), which is what every one of these statements requires, and below the
 * runtime set (`…535`+), because a constraint belongs with its schema rather than with a data revision.
 *
 * **Every statement is probed, so a re-run is a no-op.** The probe is `hasTable` for both ends,
 * `hasColumn` for the referencing column, and a constraint lookup by name: the runner's own
 * `hasConstraint` where the installed driver provides it, and otherwise the table definition the runner
 * reads back from the schema. That last fallback is not decoration — on a fresh installation the pricing
 * set's own `CREATE TABLE` already declares `FK_price_list_customer_group` inline, so this migration
 * must find it and add nothing; and on an installation whose schema was synchronised from the entities
 * there is no migration history at all, only whatever constraints the schema happens to carry.
 *
 * **SQLite is a documented no-op.** This dialect cannot add a constraint to an existing table, and the
 * runner has no statement for it. A fresh SQLite installation therefore gets the two references that can
 * be inline — `price_list.customerGroupId → contact_group` and `promotion.customerGroupId →
 * contact_group` are both declared inside their own `CREATE TABLE` by the sets that create those
 * tables, which run after this kernel's creating migration — and gets `contact_group.priceListId`
 * **without** a constraint, because that column is created before its target exists and cannot be
 * revisited afterwards. There the rule is the service check plus the nightly schema audit, exactly as
 * the conventions chapter provides for every constraint this dialect cannot carry. Nothing is written
 * here rather than something that would fail: a migration that throws on the embedded dialect takes the
 * whole install with it.
 */
export class AddContactExtensionForeignKeys1791000000532 implements MigrationInterface {
	name = 'AddContactExtensionForeignKeys1791000000532';

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
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addReferences(queryRunner, '"');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * Drops only the constraints this migration could have added, in reverse order, and only where they
	 * are present: a `down` that names a constraint the installation never had is a `down` that fails on
	 * a database it was supposed to leave alone.
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const reference of [...REFERENCES].reverse()) {
			if (await this.hasReference(queryRunner, reference)) {
				await queryRunner.query(
					`ALTER TABLE "${reference.table}" DROP CONSTRAINT IF EXISTS "${reference.constraint}"`
				);
			}
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * Nothing, and deliberately: this dialect cannot add a foreign key to an existing table, so there is
	 * no statement to issue. A fresh installation gets the two references that can be declared inline
	 * from the sets that create `price_list` and `promotion`; `contact_group.priceListId` carries none,
	 * and the rule there is the service check plus the nightly schema audit. See the class note.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// A documented no-op — see the class note.
		void queryRunner;
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * Nothing, for the same reason the up writes nothing: there is no constraint this migration could
	 * have added on this dialect, so there is none to remove.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// A documented no-op — see the class note.
		void queryRunner;
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index and no `DROP CONSTRAINT IF EXISTS`, but it does read a table's
	 * constraint list back, so the same probe decides every statement here.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addReferences(queryRunner, '`');
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const reference of [...REFERENCES].reverse()) {
			if (await this.hasReference(queryRunner, reference)) {
				await queryRunner.query(
					`ALTER TABLE ${'`'}${reference.table}${'`'} DROP FOREIGN KEY ${'`'}${reference.constraint}${'`'}`
				);
			}
		}
	}

	/**
	 * Adds every reference that is missing and can be added.
	 *
	 * The three probes are the whole of the idempotence: the two ends must exist (`hasTable`), the
	 * referencing column must exist (`hasColumn` — a capability that stores its scope elsewhere must not
	 * fail the install), and the constraint must not already be there.
	 *
	 * @param queryRunner The runner the statements are issued on.
	 * @param quote The dialect's identifier quote: `"` on Postgres, a backtick on MySQL.
	 */
	private async addReferences(queryRunner: QueryRunner, quote: string): Promise<void> {
		for (const reference of REFERENCES) {
			if (await this.hasReference(queryRunner, reference)) {
				// Already there — on this installation the constraint arrived with the set that created
				// the referencing table, and adding it again is the one thing this migration must not do.
				continue;
			}

			if (!(await queryRunner.hasTable(reference.table)) || !(await queryRunner.hasTable(reference.target))) {
				continue;
			}

			if (!(await queryRunner.hasColumn(reference.table, reference.column))) {
				continue;
			}

			// An optional reference releases rather than cascades: the row that named the target must
			// survive its removal, and it already carries what it needs to stand alone.
			const policy = reference.optional ? 'SET NULL' : 'CASCADE';

			await queryRunner.query(
				`ALTER TABLE ${quote}${reference.table}${quote} ADD CONSTRAINT ${quote}${reference.constraint}${quote} FOREIGN KEY (${quote}${reference.column}${quote}) REFERENCES ${quote}${reference.target}${quote}(${quote}id${quote}) ON DELETE ${policy} ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * Whether one reference is already in place, at both ends and by name.
	 *
	 * The runner's own `hasConstraint` is used where the installed driver provides it. Where it does not
	 * — the runner this platform ships exposes `hasTable`, `hasColumn` and the table read-back, and no
	 * named-constraint predicate — the constraint list is read from the table definition, which is the
	 * same schema the predicate would consult and works on every dialect this migration writes to.
	 *
	 * @param queryRunner The runner to probe with.
	 * @param reference The reference to look for.
	 * @returns True when the referencing table exists and already carries the constraint.
	 */
	private async hasReference(queryRunner: QueryRunner, reference: ContactReference): Promise<boolean> {
		if (!(await queryRunner.hasTable(reference.table))) {
			return false;
		}

		const runner = queryRunner as unknown as {
			hasConstraint?: (table: string, constraint: string) => Promise<boolean>;
		};

		if (typeof runner.hasConstraint === 'function') {
			return Boolean(await runner.hasConstraint(reference.table, reference.constraint));
		}

		const definition = (await queryRunner.getTable(reference.table)) as
			| {
					foreignKeys?: Array<{ name?: string }>;
					uniques?: Array<{ name?: string }>;
					checks?: Array<{ name?: string }>;
			  }
			| undefined;

		if (!definition) {
			return false;
		}

		const names = [
			...(definition.foreignKeys ?? []),
			...(definition.uniques ?? []),
			...(definition.checks ?? [])
		].map((one) => String(one?.name ?? ''));

		return names.includes(reference.constraint);
	}
}
