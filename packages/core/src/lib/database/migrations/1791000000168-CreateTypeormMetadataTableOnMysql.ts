import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates TypeORM's own `typeorm_metadata` table on MySQL, where the platform's migrations need it to exist.
 *
 * **Why a migration has to.** On MySQL, `queryRunner.getTable()` reads the expression of every generated column a
 * table carries from `typeorm_metadata`, and it does so unconditionally: a table with a generated column and an
 * installation without that table fail with `1146 Table '<db>.typeorm_metadata' doesn't exist`. TypeORM creates
 * the table only from its schema synchroniser, which this platform never runs — it migrates — so nothing created it.
 * From `1791000000095` on, MySQL tables carry generated keys (`deletedKey`, `organizationKey`, …, the fallback for
 * partial unique indexes), and `1791000000170-AddAddressBookForeignKeys` was the first migration to call
 * `getTable()` on one of them (`address_role`): a fresh MySQL stopped there. Seven later migrations probe tables the
 * same way.
 *
 * **What it creates** is exactly what TypeORM's `RdbmsSchemaBuilder.createTypeormMetadataTable` creates for the MySQL
 * driver — the same name (the connection's `metadataTableName`), the same six columns, the same types — and only when
 * the table is not there, so an installation that already has one (a synchronise run, an earlier TypeORM) is left as
 * it is, and TypeORM can go on writing to it. It stays empty here: the probes only ask for foreign keys and columns,
 * and an absent row reads as "no recorded expression", which is what they need.
 *
 * Nothing happens on PostgreSQL or SQLite, whose probes read their catalogue instead.
 */
export class CreateTypeormMetadataTableOnMysql1791000000168 implements MigrationInterface {
	name = 'CreateTypeormMetadataTableOnMysql1791000000168';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		if ((queryRunner.connection.options.type as DatabaseTypeEnum) !== DatabaseTypeEnum.mysql) {
			return;
		}

		const table = queryRunner.connection.metadataTableName;

		if (await queryRunner.hasTable(table)) {
			return;
		}

		await queryRunner.query(
			`CREATE TABLE \`${table}\` (\`type\` varchar(255) NOT NULL, \`database\` varchar(255) NULL, \`schema\` varchar(255) NULL, \`table\` varchar(255) NULL, \`name\` varchar(255) NULL, \`value\` text NULL) ENGINE=InnoDB`
		);

		console.log(chalk.yellow(`${this.name}: created \`${table}\` for the generated-column probes of later migrations.`));
	}

	/**
	 * Down Migration
	 *
	 * The table is left in place: TypeORM itself may have written to it since, and removing it would break every
	 * later probe of a table with a generated column. Reverting this migration is therefore a no-op.
	 *
	 * @param queryRunner
	 */
	public async down(_queryRunner: QueryRunner): Promise<void> {
		return;
	}
}
