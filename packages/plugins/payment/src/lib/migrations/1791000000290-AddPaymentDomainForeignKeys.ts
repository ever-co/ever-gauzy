import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the foreign keys that point at this package's tables from columns the kernel created without
 * them.
 *
 * The rule the migration plan states is exactly this: a column whose target table is created by a later
 * set is created **without** its foreign key, and the set that creates the target adds the constraint in
 * a migration of its own. Those columns exist before this package does — the core `payment` row is
 * extended with the three references of the provider lifecycle, and the two instrument tables are
 * extended with the provider they belong to — so this is the migration that closes them.
 *
 * Every statement is guarded by the presence of the column or the table it names, because the kernel
 * alterations that create them are a separate set: an installation that has not applied them yet is a
 * valid installation, and a missing optional column is not a reason for a migration to fail. On an
 * installation where the columns are absent this file therefore does nothing, and it does it loudly in
 * the sense that the absence is what the guard reads — not a silently swallowed error.
 *
 * The kernel's own `payment.orderId` reference is **not** here. That one points at the order aggregate,
 * whose set creates it, and `1791000000230-AddPaymentOrderForeignKey` already carries it.
 */
export class AddPaymentDomainForeignKeys1791000000290 implements MigrationInterface {
	name = 'AddPaymentDomainForeignKeys1791000000290';

	/**
	 * The references the core `payment` row carries into this package's tables, and the delete action
	 * each one needs. A payment whose collection is removed keeps its own row — the money moved and is
	 * on record — so the reference is released rather than cascaded.
	 */
	private static readonly PAYMENT_REFERENCES: ReadonlyArray<{
		readonly column: string;
		readonly constraint: string;
		readonly target: string;
	}> = [
		{ column: 'paymentCollectionId', constraint: 'FK_payment_payment_collection', target: 'payment_collection' },
		{ column: 'paymentSessionId', constraint: 'FK_payment_payment_session', target: 'payment_session' },
		{ column: 'paymentProviderId', constraint: 'FK_payment_payment_provider', target: 'payment_provider' }
	];

	/**
	 * The instrument tables of the kernel, each carrying the provider registration it belongs to. A
	 * provider that is removed takes its instruments with it: an instrument that names no provider can
	 * never be charged again.
	 */
	private static readonly INSTRUMENT_TABLES: readonly string[] = ['payment_account_holder', 'payment_method_token'];

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
		for (const reference of AddPaymentDomainForeignKeys1791000000290.PAYMENT_REFERENCES) {
			if (await queryRunner.hasColumn('payment', reference.column)) {
				await queryRunner.query(
					`ALTER TABLE "payment" ADD CONSTRAINT "${reference.constraint}" FOREIGN KEY ("${reference.column}") REFERENCES "${reference.target}"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
				);
			}
		}

		for (const table of AddPaymentDomainForeignKeys1791000000290.INSTRUMENT_TABLES) {
			if (await queryRunner.hasTable(table)) {
				await queryRunner.query(
					`ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_provider" FOREIGN KEY ("paymentProviderId") REFERENCES "payment_provider"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
				);
			}
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const table of AddPaymentDomainForeignKeys1791000000290.INSTRUMENT_TABLES) {
			if (await queryRunner.hasTable(table)) {
				await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_provider"`);
			}
		}

		for (const reference of AddPaymentDomainForeignKeys1791000000290.PAYMENT_REFERENCES) {
			if (await queryRunner.hasColumn('payment', reference.column)) {
				await queryRunner.query(`ALTER TABLE "payment" DROP CONSTRAINT "${reference.constraint}"`);
			}
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a foreign key to an existing table, so a table that gains one is rebuilt from
	 * its own definition with the constraint appended, its rows copied across, and its indexes replayed
	 * — the table's definition is read back from `sqlite_master` rather than restated here, which is what
	 * keeps this file from drifting away from the table's actual shape.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');

		for (const reference of AddPaymentDomainForeignKeys1791000000290.PAYMENT_REFERENCES) {
			if (await queryRunner.hasColumn('payment', reference.column)) {
				await this.sqliteAddForeignKey(queryRunner, 'payment', {
					constraint: reference.constraint,
					column: reference.column,
					target: reference.target,
					onDelete: 'SET NULL'
				});
			}
		}

		for (const table of AddPaymentDomainForeignKeys1791000000290.INSTRUMENT_TABLES) {
			if (await queryRunner.hasTable(table)) {
				await this.sqliteAddForeignKey(queryRunner, table, {
					constraint: `FK_${table}_provider`,
					column: 'paymentProviderId',
					target: 'payment_provider',
					onDelete: 'CASCADE'
				});
			}
		}

		await queryRunner.query('PRAGMA foreign_keys = ON');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * The inverse rebuilds each table without the constraint this migration added — the only way this
	 * dialect can remove one, having no `ALTER TABLE ... DROP CONSTRAINT`.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query('PRAGMA foreign_keys = OFF');

		for (const table of AddPaymentDomainForeignKeys1791000000290.INSTRUMENT_TABLES) {
			await this.sqliteRemoveForeignKey(queryRunner, table, `FK_${table}_provider`);
		}

		for (const reference of AddPaymentDomainForeignKeys1791000000290.PAYMENT_REFERENCES) {
			await this.sqliteRemoveForeignKey(queryRunner, 'payment', reference.constraint);
		}

		await queryRunner.query('PRAGMA foreign_keys = ON');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const reference of AddPaymentDomainForeignKeys1791000000290.PAYMENT_REFERENCES) {
			if (await queryRunner.hasColumn('payment', reference.column)) {
				await queryRunner.query(
					`ALTER TABLE \`payment\` ADD CONSTRAINT \`${reference.constraint}\` FOREIGN KEY (\`${reference.column}\`) REFERENCES \`${reference.target}\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
				);
			}
		}

		for (const table of AddPaymentDomainForeignKeys1791000000290.INSTRUMENT_TABLES) {
			if (await queryRunner.hasTable(table)) {
				await queryRunner.query(
					`ALTER TABLE \`${table}\` ADD CONSTRAINT \`FK_${table}_provider\` FOREIGN KEY (\`paymentProviderId\`) REFERENCES \`payment_provider\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
				);
			}
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const table of AddPaymentDomainForeignKeys1791000000290.INSTRUMENT_TABLES) {
			if (await queryRunner.hasTable(table)) {
				await queryRunner.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`FK_${table}_provider\``);
			}
		}

		for (const reference of AddPaymentDomainForeignKeys1791000000290.PAYMENT_REFERENCES) {
			if (await queryRunner.hasColumn('payment', reference.column)) {
				await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`${reference.constraint}\``);
			}
		}
	}

	/**
	 * Rebuilds a SQLite table with one foreign key appended.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 * @param foreignKey The constraint to add.
	 */
	private async sqliteAddForeignKey(
		queryRunner: QueryRunner,
		table: string,
		foreignKey: { readonly constraint: string; readonly column: string; readonly target: string; readonly onDelete: string }
	): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || definition.includes(foreignKey.constraint)) {
			return;
		}

		const withConstraint = definition.replace(
			/\)\s*$/,
			`, CONSTRAINT "${foreignKey.constraint}" FOREIGN KEY ("${foreignKey.column}") REFERENCES "${foreignKey.target}" ("id") ON DELETE ${foreignKey.onDelete} ON UPDATE NO ACTION)`
		);

		await this.rebuildSqliteTable(queryRunner, table, withConstraint);
	}

	/**
	 * Rebuilds a SQLite table with one foreign key removed.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 * @param constraint The constraint to remove.
	 */
	private async sqliteRemoveForeignKey(
		queryRunner: QueryRunner,
		table: string,
		constraint: string
	): Promise<void> {
		const definition = await this.sqliteDefinitionOf(queryRunner, table);

		if (!definition || !definition.includes(constraint)) {
			return;
		}

		const withoutConstraint = definition.replace(
			new RegExp(`,\\s*CONSTRAINT "${constraint}"[\\s\\S]*\\)\\s*$`),
			')'
		);

		await this.rebuildSqliteTable(queryRunner, table, withoutConstraint);
	}

	/**
	 * Replaces a SQLite table with a rebuilt definition of itself, keeping its rows and its indexes.
	 *
	 * SQLite drops a table's indexes with the table, so the index statements are read before the rename
	 * and replayed after the backup has gone — rebuilding a table without them would leave a table that
	 * is correct and unindexed, which is a performance defect that no test would report.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table to rebuild.
	 * @param definition The table's new `CREATE TABLE` statement.
	 */
	private async rebuildSqliteTable(queryRunner: QueryRunner, table: string, definition: string): Promise<void> {
		const indexes = await this.sqliteIndexesOf(queryRunner, table);

		await queryRunner.query(`ALTER TABLE "${table}" RENAME TO "${table}_payment_fk_backup"`);
		await queryRunner.query(definition);
		await queryRunner.query(`INSERT INTO "${table}" SELECT * FROM "${table}_payment_fk_backup"`);
		await queryRunner.query(`DROP TABLE "${table}_payment_fk_backup"`);

		for (const index of indexes) {
			await queryRunner.query(index);
		}
	}

	/**
	 * Reads a SQLite table's own `CREATE TABLE` statement.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table.
	 * @returns The statement, or null when the table does not exist.
	 */
	private async sqliteDefinitionOf(queryRunner: QueryRunner, table: string): Promise<string | null> {
		const rows: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`,
			[table]
		);

		return rows?.[0]?.sql ?? null;
	}

	/**
	 * Reads the `CREATE INDEX` statements of a SQLite table.
	 *
	 * @param queryRunner The query runner.
	 * @param table The table.
	 * @returns The statements, in the order SQLite holds them.
	 */
	private async sqliteIndexesOf(queryRunner: QueryRunner, table: string): Promise<string[]> {
		const rows: Array<{ sql?: string }> = await queryRunner.query(
			`SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL`,
			[table]
		);

		return (rows ?? []).map((row) => row.sql).filter((sql): sql is string => Boolean(sql));
	}
}
