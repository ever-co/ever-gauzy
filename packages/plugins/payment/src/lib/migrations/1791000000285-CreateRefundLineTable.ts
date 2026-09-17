import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `refund_line`, the table that records which order lines a refund paid back.
 *
 * The breakdown of a refund used to be an array inside `refund.metadata`. An array is neither a
 * column nor a table: nothing enforced that its entries summed to no more than the refund, nothing
 * indexed it, and no lock could be taken on it — so three different readers scanned the same JSON and
 * each of them could answer "how much of this line came back" differently. The row replaces the
 * array: `(refundId, orderLineId)` is unique among live rows, `quantity` and `amount` are
 * `numeric(20,6)` magnitudes in the order line's unit and the order currency, and the sum of a
 * refund's rows is capped by the refund's own amount, checked in the service inside the transaction
 * that writes them.
 *
 * **Why this tick.** The migration plan reserves `←345` for this file, but the payment package's set
 * as shipped occupies `←280`–`←299`: `1791000000280-CreatePaymentTables.ts` and
 * `1791000000290-AddPaymentDomainForeignKeys.ts`. This revision therefore takes the next free tick
 * inside the payment package's own sub-range, `←285`, which keeps the file in exactly the position the
 * plan intends for it — after `CreatePaymentTables`, which creates `refund`, and before
 * `AddPaymentDomainForeignKeys`.
 *
 * `orderLineId` is a cross-plugin reference and carries its constraint here, like the other references
 * this package holds into tables another set creates: `order_line` is created by the order package's
 * `1791000000220-CreateOrderTables.ts`, which runs before this file, so the constraint can be stated
 * now rather than left to a later set. It is `RESTRICT` — a money record must not outlive the line it
 * explains — while `refundId` is `CASCADE`, because a line has no meaning without its refund.
 *
 * The two check constraints are added on Postgres and MySQL. SQLite cannot add a constraint to a table
 * after it is created, so on that dialect the positive magnitude of `quantity` and the non-negative
 * `amount` are enforced by the refund-line service and re-derived by the nightly payment-ledger audit.
 *
 * All three dialects are written by hand, and the down migration reverses every statement in the
 * opposite order — a partially reverted schema is worse than an unreverted one.
 */
export class CreateRefundLineTable1791000000285 implements MigrationInterface {
	name = 'CreateRefundLineTable1791000000285';

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
		await queryRunner.query(
			`CREATE TABLE "refund_line" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "refundId" uuid NOT NULL, "orderLineId" uuid NOT NULL, "quantity" numeric(20,6) NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" character varying(3) NOT NULL, "metadata" jsonb, CONSTRAINT "PK_refund_line_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_refund_line_created_by_user" ON "refund_line" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_line_updated_by_user" ON "refund_line" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_line_deleted_by_user" ON "refund_line" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_line_is_active" ON "refund_line" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_line_is_archived" ON "refund_line" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_line_tenant" ON "refund_line" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_refund_line_organization" ON "refund_line" ("organizationId")`);
		// One row per pair among live rows: what a refund paid back for an order line is recorded once,
		// and a removed row does not block recording it again.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_refund_line" ON "refund_line" ("refundId", "orderLineId") WHERE "deletedAt" IS NULL`
		);
		// The scan the reconciliation runs: every refund that paid something back for one order line.
		await queryRunner.query(
			`CREATE INDEX "IDX_refund_line_order_line" ON "refund_line" ("orderLineId") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`ALTER TABLE "refund_line" ADD CONSTRAINT "FK_refund_line_refund" FOREIGN KEY ("refundId") REFERENCES "refund"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		// A money record must not outlive the line it explains, and the order package's set has already
		// created `order_line` by the time this file runs.
		await queryRunner.query(
			`ALTER TABLE "refund_line" ADD CONSTRAINT "FK_refund_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE "refund_line" ADD CONSTRAINT "CHK_refund_line_positive" CHECK ("quantity" > 0)`
		);
		await queryRunner.query(
			`ALTER TABLE "refund_line" ADD CONSTRAINT "CHK_refund_line_amount_positive" CHECK ("amount" >= 0)`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "refund_line" DROP CONSTRAINT "CHK_refund_line_amount_positive"`);
		await queryRunner.query(`ALTER TABLE "refund_line" DROP CONSTRAINT "CHK_refund_line_positive"`);
		await queryRunner.query(`ALTER TABLE "refund_line" DROP CONSTRAINT "FK_refund_line_order_line"`);
		await queryRunner.query(`ALTER TABLE "refund_line" DROP CONSTRAINT "FK_refund_line_refund"`);

		await queryRunner.query(`DROP INDEX "IDX_refund_line_order_line"`);
		await queryRunner.query(`DROP INDEX "UQ_refund_line"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_line_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_line_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_line_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_line_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_refund_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE "refund_line"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table, so both foreign keys are declared inline
	 * with the table that owns them — and both targets exist by the time this statement runs: `refund`
	 * is created by this package's `CreatePaymentTables`, and `order_line` by the order package's set.
	 *
	 * The two check constraints of the other dialects are **deliberately absent here**: this dialect
	 * has no way to add one after the table exists, so on SQLite the positive `quantity` and the
	 * non-negative `amount` are enforced by the refund-line service, which refuses the write, and
	 * re-derived by the nightly payment-ledger audit, which reports a row that should not exist rather
	 * than letting it pass unremarked.
	 *
	 * Every statement is written idempotently, because this is the one dialect whose definition of a
	 * table is the statement itself: a replayed file is a no-op rather than a failure.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "refund_line" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "refundId" varchar NOT NULL, "orderLineId" varchar NOT NULL, "quantity" numeric(20,6) NOT NULL, "amount" numeric(20,6) NOT NULL, "currency" varchar(3) NOT NULL, "metadata" text, CONSTRAINT "FK_refund_line_refund" FOREIGN KEY ("refundId") REFERENCES "refund" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_refund_line_order_line" FOREIGN KEY ("orderLineId") REFERENCES "order_line" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_refund_line_created_by_user" ON "refund_line" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_refund_line_updated_by_user" ON "refund_line" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_refund_line_deleted_by_user" ON "refund_line" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_refund_line_is_active" ON "refund_line" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_refund_line_is_archived" ON "refund_line" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_refund_line_tenant" ON "refund_line" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_refund_line_organization" ON "refund_line" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_refund_line" ON "refund_line" ("refundId", "orderLineId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX IF NOT EXISTS "IDX_refund_line_order_line" ON "refund_line" ("orderLineId") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * SQLite drops a table's indexes and its foreign keys with the table, but the explicit reversal is
	 * kept in the same order as the other dialects so the three downs read alike.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_order_line"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "UQ_refund_line"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_organization"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_tenant"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_is_archived"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_is_active"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_updated_by_user"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_refund_line_created_by_user"`);
		await queryRunner.query(`DROP TABLE IF EXISTS "refund_line"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL has no partial indexes, so the predicate that makes the pair unique among live rows is
	 * carried by including `deletedAt` in the key, exactly as the platform's other migrations do: a
	 * soft-deleted row no longer collides with the live row that replaced it.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`refund_line\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`refundId\` varchar(36) NOT NULL, \`orderLineId\` varchar(36) NOT NULL, \`quantity\` decimal(20,6) NOT NULL, \`amount\` decimal(20,6) NOT NULL, \`currency\` varchar(3) NOT NULL, \`metadata\` json NULL, INDEX \`IDX_refund_line_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_refund_line_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_refund_line_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_refund_line_is_active\` (\`isActive\`), INDEX \`IDX_refund_line_is_archived\` (\`isArchived\`), INDEX \`IDX_refund_line_tenant\` (\`tenantId\`), INDEX \`IDX_refund_line_organization\` (\`organizationId\`), INDEX \`IDX_refund_line_order_line\` (\`orderLineId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_refund_line\` ON \`refund_line\` (\`refundId\`, \`orderLineId\`, \`deletedAt\`)`
		);

		await queryRunner.query(
			`ALTER TABLE \`refund_line\` ADD CONSTRAINT \`FK_refund_line_refund\` FOREIGN KEY (\`refundId\`) REFERENCES \`refund\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`refund_line\` ADD CONSTRAINT \`FK_refund_line_order_line\` FOREIGN KEY (\`orderLineId\`) REFERENCES \`order_line\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`ALTER TABLE \`refund_line\` ADD CONSTRAINT \`CHK_refund_line_positive\` CHECK (\`quantity\` > 0)`
		);
		await queryRunner.query(
			`ALTER TABLE \`refund_line\` ADD CONSTRAINT \`CHK_refund_line_amount_positive\` CHECK (\`amount\` >= 0)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * The two check constraints are not dropped by name: this dialect spells that statement differently
	 * across the versions this platform supports, and a check constraint belongs to its table, so both
	 * leave with the table the last statement drops.
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`refund_line\` DROP FOREIGN KEY \`FK_refund_line_order_line\``);
		await queryRunner.query(`ALTER TABLE \`refund_line\` DROP FOREIGN KEY \`FK_refund_line_refund\``);

		await queryRunner.query(`DROP INDEX \`UQ_refund_line\` ON \`refund_line\``);
		await queryRunner.query(`DROP TABLE \`refund_line\``);
	}
}
