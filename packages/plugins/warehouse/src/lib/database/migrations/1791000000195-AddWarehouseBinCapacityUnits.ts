import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Gives a bin's three planning limits the units they are expressed in.
 *
 * `capacityUnits`, `maxWeight` and `maxVolume` were bare numbers. A capacity is a quantity **in a
 * stated unit**, and without one the same physical limit can be entered as `1` by an operator thinking
 * in pallets and read as `1` by a put-away request thinking in pieces — both readings internally
 * consistent, and the comparison between them meaningless. The domain already models a pallet position
 * whose unit of handling is the pallet, and the allocator and the low-stock tie-break make decisions
 * from the capacity, so an uninterpreted number propagates into allocation rather than staying a
 * warning on a screen.
 *
 * The three columns are added **nullable and are not backfilled**, which is the one place in the
 * measurement model where the correct migration is a question rather than a default. Every existing
 * bin carries a capacity its operator conceived in whatever unit they had in mind; defaulting to
 * pieces would silently redefine a pallet position's capacity of `1` as a single item. The honest
 * migration is to leave the unit null — which keeps the previous behaviour exactly, an uninterpreted
 * count — and to surface the uninterpreted bins so an operator declares the unit. That report is
 * `warehouse-bin/capacity-warnings` (REST) and `warehouseBinCapacityWarnings` (GraphQL), and the
 * warning code it carries is `WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED`.
 *
 * **Why this timestamp.** This package's shipped set occupies `1791000000180` and `1791000000190`
 * inside the warehouse sub-range, and a migration's timestamp is frozen once it has shipped. The
 * revision therefore takes the **next free tick of this package's own sub-range**, `1791000000195`,
 * which places it after both shipped files, as intended.
 *
 * **The three columns carry no foreign key, deliberately.** Their target is `unit`, which belongs to
 * the kernel's measurement set: the programme's rule is that a constraint is added by the set that
 * owns its target, and this package must not constrain a table it does not create — a migration that
 * named `unit` before that set had run would fail on a clean install. The columns are therefore plain
 * uuids, exactly as the purchasing set leaves its own `unitId`, and the service states what a null
 * unit means rather than guessing at one.
 *
 * Every addition is guarded by `hasColumn`, and the index is created with `IF NOT EXISTS` on the two
 * dialects that support it and through the catalogue on MySQL, so a second run of this file adds
 * nothing. The inverse drops what it added and returns the table to the shape an installation had
 * before the revision.
 */
export class AddWarehouseBinCapacityUnits1791000000195 implements MigrationInterface {
	name = 'AddWarehouseBinCapacityUnits1791000000195';

	/** The table whose three limits gain their unit. */
	private static readonly BIN_TABLE = 'warehouse_bin';

	/** The partial index over the capacity's unit, which is what the capacity job scans. */
	private static readonly CAPACITY_UNIT_INDEX = 'IDX_warehouse_bin_capacity_unit';

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
		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'capacityUnitId'))) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" ADD COLUMN "capacityUnitId" uuid`);
		}
		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxWeightUnitId'))) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" ADD COLUMN "maxWeightUnitId" uuid`);
		}
		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxVolumeUnitId'))) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" ADD COLUMN "maxVolumeUnitId" uuid`);
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_warehouse_bin_capacity_unit" ON "warehouse_bin" ("capacityUnitId") WHERE "capacityUnitId" IS NOT NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE))) {
			return;
		}

		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_warehouse_bin_capacity_unit"`);

		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxVolumeUnitId')) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" DROP COLUMN "maxVolumeUnitId"`);
		}
		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxWeightUnitId')) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" DROP COLUMN "maxWeightUnitId"`);
		}
		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'capacityUnitId')) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" DROP COLUMN "capacityUnitId"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite accepts an added nullable column without rebuilding the table, so nothing here needs the
	 * copy-and-rename dance the nullability changes elsewhere in the programme require: every column
	 * this file adds is nullable and carries no default, which is exactly the shape the dialect adds in
	 * place.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'capacityUnitId'))) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" ADD COLUMN "capacityUnitId" varchar`);
		}
		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxWeightUnitId'))) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" ADD COLUMN "maxWeightUnitId" varchar`);
		}
		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxVolumeUnitId'))) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" ADD COLUMN "maxVolumeUnitId" varchar`);
		}

		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_warehouse_bin_capacity_unit" ON "warehouse_bin" ("capacityUnitId") WHERE "capacityUnitId" IS NOT NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE))) {
			return;
		}

		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_warehouse_bin_capacity_unit"`);

		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxVolumeUnitId')) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" DROP COLUMN "maxVolumeUnitId"`);
		}
		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxWeightUnitId')) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" DROP COLUMN "maxWeightUnitId"`);
		}
		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'capacityUnitId')) {
			await queryRunner.query(`ALTER TABLE "warehouse_bin" DROP COLUMN "capacityUnitId"`);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the index over the capacity's unit loses its predicate and the
	 * rule the predicate expressed — the report only ever reads the bins that declare one — stays a
	 * read-time filter, exactly as the programme provides for a rule the dialect cannot state.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE))) {
			return;
		}

		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'capacityUnitId'))) {
			await queryRunner.query(`ALTER TABLE \`warehouse_bin\` ADD COLUMN \`capacityUnitId\` varchar(36) NULL`);
		}
		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxWeightUnitId'))) {
			await queryRunner.query(`ALTER TABLE \`warehouse_bin\` ADD COLUMN \`maxWeightUnitId\` varchar(36) NULL`);
		}
		if (!(await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxVolumeUnitId'))) {
			await queryRunner.query(`ALTER TABLE \`warehouse_bin\` ADD COLUMN \`maxVolumeUnitId\` varchar(36) NULL`);
		}

		if (!(await this.hasIndex(queryRunner, AddWarehouseBinCapacityUnits1791000000195.CAPACITY_UNIT_INDEX))) {
			await queryRunner.query(
				`CREATE INDEX \`IDX_warehouse_bin_capacity_unit\` ON \`warehouse_bin\` (\`capacityUnitId\`)`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE))) {
			return;
		}

		if (await this.hasIndex(queryRunner, AddWarehouseBinCapacityUnits1791000000195.CAPACITY_UNIT_INDEX)) {
			await queryRunner.query(`DROP INDEX \`IDX_warehouse_bin_capacity_unit\` ON \`warehouse_bin\``);
		}

		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxVolumeUnitId')) {
			await queryRunner.query(`ALTER TABLE \`warehouse_bin\` DROP COLUMN \`maxVolumeUnitId\``);
		}
		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'maxWeightUnitId')) {
			await queryRunner.query(`ALTER TABLE \`warehouse_bin\` DROP COLUMN \`maxWeightUnitId\``);
		}
		if (await queryRunner.hasColumn(AddWarehouseBinCapacityUnits1791000000195.BIN_TABLE, 'capacityUnitId')) {
			await queryRunner.query(`ALTER TABLE \`warehouse_bin\` DROP COLUMN \`capacityUnitId\``);
		}
	}

	/**
	 * @param queryRunner The query runner.
	 * @param name The index name.
	 * @returns True when MySQL already carries an index of that name.
	 */
	private async hasIndex(queryRunner: QueryRunner, name: string): Promise<boolean> {
		const rows: Array<{ counted?: string | number }> = await queryRunner.query(
			`SELECT COUNT(*) AS counted FROM information_schema.statistics WHERE table_schema = DATABASE() AND index_name = '${name}'`
		);

		return Number(rows?.[0]?.counted ?? 0) > 0;
	}
}
