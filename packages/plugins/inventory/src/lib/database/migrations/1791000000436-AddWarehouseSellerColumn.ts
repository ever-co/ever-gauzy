import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the seller scope to a stock location, which is what makes a seller's own stock its own.
 *
 * ## Why the column is here and the constraint is not
 *
 * `warehouse` is a kernel table, and doc 20 §13.7 records this column as delivered by this set **without
 * its foreign key**: the target, `seller`, is created by the marketplace set, which runs later — a column
 * cannot be constrained onto a table that does not exist yet, and the constraint is what
 * `AddMarketplaceAmendmentColumns` adds once that table is there. This is the same rule every other
 * cross-set reference in this programme follows, and it is stated here because a reader who finds an
 * unconstrained `sellerId` in the schema would otherwise have to guess whether it was deliberate.
 *
 * ## What the column means
 *
 * A location with no seller is the platform's own; one that names a seller is that seller's stock, and a
 * marketplace reads it to answer "what can this seller fulfil from" without walking the offerings. The
 * index carries `isFulfillmentLocation` because that is the question asked of it: the locations a channel
 * may allocate from, per seller.
 *
 * ## Dialects
 *
 * Every dialect can add a nullable column, so unlike the constraint migrations of this programme this one
 * runs everywhere: SQLite gets the column and the index (its `ALTER TABLE … ADD COLUMN` and `CREATE
 * INDEX` are both supported), and PostgreSQL and MySQL get the same. The index is created without the
 * partial predicate on MySQL, which has no filtered index, exactly as §1.7 provides.
 */
export class AddWarehouseSellerColumn1791000000436 implements MigrationInterface {
	name = 'AddWarehouseSellerColumn1791000000436';

	/** The table and the column this tick adds to it. */
	private static readonly TABLE = 'warehouse';
	private static readonly COLUMN = 'sellerId';
	private static readonly INDEX = 'IDX_warehouse_seller';

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
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumn(queryRunner, `ALTER TABLE "warehouse" ADD COLUMN "sellerId" varchar`);
		await this.addIndex(
			queryRunner,
			`CREATE INDEX "${AddWarehouseSellerColumn1791000000436.INDEX}" ON "warehouse" ("sellerId", "isFulfillmentLocation") WHERE "sellerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(queryRunner, `DROP INDEX IF EXISTS "${AddWarehouseSellerColumn1791000000436.INDEX}"`);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumn(queryRunner, `ALTER TABLE "warehouse" ADD COLUMN "sellerId" uuid`);
		await this.addIndex(
			queryRunner,
			`CREATE INDEX "${AddWarehouseSellerColumn1791000000436.INDEX}" ON "warehouse" ("sellerId", "isFulfillmentLocation") WHERE "sellerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(queryRunner, `DROP INDEX IF EXISTS "${AddWarehouseSellerColumn1791000000436.INDEX}"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no filtered index, so the index is created without its predicate, as §1.7 provides: the
	 * lookup narrows by the pair and the rows where `sellerId` is null are simply not asked for.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumn(
			queryRunner,
			`ALTER TABLE \`warehouse\` ADD COLUMN \`sellerId\` varchar(36) NULL`
		);
		await this.addIndex(
			queryRunner,
			`CREATE INDEX \`${AddWarehouseSellerColumn1791000000436.INDEX}\` ON \`warehouse\` (\`sellerId\`, \`isFulfillmentLocation\`)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropIndex(
			queryRunner,
			`DROP INDEX \`${AddWarehouseSellerColumn1791000000436.INDEX}\` ON \`warehouse\``
		);
	}

	/**
	 * Adds the column when the table is there and the column is not.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `ALTER TABLE … ADD COLUMN`.
	 */
	private async addColumn(queryRunner: QueryRunner, statement: string): Promise<void> {
		const { TABLE, COLUMN } = AddWarehouseSellerColumn1791000000436;

		if (!(await queryRunner.hasTable(TABLE))) return;
		if (await queryRunner.hasColumn(TABLE, COLUMN)) return;

		await queryRunner.query(statement);
		console.log(chalk.yellow(`${this.name}: added ${TABLE}.${COLUMN}.`));
	}

	/**
	 * Creates the index unless the table cannot carry one yet, or already does.
	 *
	 * **The idempotence is not decoration.** A migration runs inside the platform's retry wrapper: if
	 * anything makes an attempt fail after this statement has run — a lock held by another connection, a
	 * later migration that throws — the whole set is replayed, and a `CREATE INDEX` that throws on the
	 * second attempt is a run that can never record itself. The observed failure mode is a boot that never
	 * finishes, with no message saying why, which is why the duplicate is tolerated here the way the
	 * marketplace's amendment migration tolerates it.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `CREATE INDEX`.
	 */
	private async addIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		const { TABLE, COLUMN } = AddWarehouseSellerColumn1791000000436;

		if (!(await queryRunner.hasTable(TABLE))) return;
		if (!(await queryRunner.hasColumn(TABLE, COLUMN))) return;

		try {
			await queryRunner.query(statement);
			console.log(chalk.yellow(`${this.name}: created ${AddWarehouseSellerColumn1791000000436.INDEX}.`));
		} catch (error) {
			// The index being there already is the state this statement is trying to reach; anything else is
			// re-raised, because a silently missing index is a query that reads a whole table.
			if (!/already exists|Duplicate key name/i.test(String((error as Error)?.message))) {
				throw error;
			}
		}
	}

	/**
	 * Drops the index, tolerating its absence so a re-run of `down()` is a no-op.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own `DROP INDEX`.
	 */
	private async dropIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		try {
			await queryRunner.query(statement);
		} catch {
			// An index that is not there is the state this method is trying to reach.
		}
	}
}
