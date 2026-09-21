import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the durable-operation header and its steps.
 *
 * These two tables are the saga runtime's storage: a long, multi-step, cross-aggregate operation
 * persists its plan, its progress and the data each compensator needs, so it survives a restart,
 * resumes at the first step that did not complete, and can be undone in reverse. Two uniqueness
 * rules carry the guarantees the runtime makes — at most one live operation per aggregate, and one
 * operation per caller-supplied idempotency key.
 */
export class CreateOperationTables1791000000030 implements MigrationInterface {
	name = 'CreateOperationTables1791000000030';

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
			`CREATE TABLE "operation" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "type" character varying(64) NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "input" jsonb NOT NULL DEFAULT '{}', "state" jsonb, "result" jsonb, "attemptCount" integer NOT NULL DEFAULT 0, "maxAttempts" integer NOT NULL DEFAULT 3, "lastError" text, "idempotencyKey" character varying(255), "parentOperationId" uuid, "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, "deadlineAt" TIMESTAMP, "aggregateType" character varying(64), "aggregateId" uuid, "correlationId" uuid, CONSTRAINT "PK_operation_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_operation_created_by_user" ON "operation" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_updated_by_user" ON "operation" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_deleted_by_user" ON "operation" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_is_active" ON "operation" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_is_archived" ON "operation" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_tenant" ON "operation" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_organization" ON "operation" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_status_avail" ON "operation" ("status", "createdAt") WHERE "status" IN ('PENDING','RUNNING')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_org_type" ON "operation" ("organizationId", "type", "createdAt") WHERE "deletedAt" IS NULL`
		);
		// The stuck-operation scan reads deadlines, and only for operations that can still be stuck.
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_deadline" ON "operation" ("deadlineAt") WHERE "deadlineAt" IS NOT NULL AND "status" IN ('PENDING','RUNNING','COMPENSATING')`
		);
		await queryRunner.query(`CREATE INDEX "IDX_operation_parent" ON "operation" ("parentOperationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_correlation" ON "operation" ("correlationId") WHERE "correlationId" IS NOT NULL`
		);
		// Caller-level idempotency: a retried submission returns the original operation.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_operation_idem" ON "operation" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`
		);
		// The exclusivity rule: two concurrent checkouts of one cart, or two captures of one order,
		// cannot both proceed — the second insert fails and the caller is handed the live operation.
		// `aggregateId` is nullable and is deliberately left raw, so a null exempts the row: an operation
		// that names a type and no particular aggregate has nothing to be exclusive over, and folding the
		// null would serialise every operation of that type against every other.
		// null-exempt: operation.aggregateId
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_operation_aggregate_live" ON "operation" ("aggregateType", "aggregateId") WHERE "aggregateType" IS NOT NULL AND "status" IN ('PENDING','RUNNING','COMPENSATING') AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "operation" ADD CONSTRAINT "FK_operation_parent" FOREIGN KEY ("parentOperationId") REFERENCES "operation"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "operation_step" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "operationId" uuid NOT NULL, "name" character varying(64) NOT NULL, "order" integer NOT NULL, "status" character varying NOT NULL DEFAULT 'PENDING', "input" jsonb, "output" jsonb, "compensationData" jsonb, "attemptCount" integer NOT NULL DEFAULT 0, "lastError" text, "startedAt" TIMESTAMP, "finishedAt" TIMESTAMP, CONSTRAINT "PK_operation_step_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_created_by_user" ON "operation_step" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_updated_by_user" ON "operation_step" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_deleted_by_user" ON "operation_step" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_is_active" ON "operation_step" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_is_archived" ON "operation_step" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_tenant" ON "operation_step" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_organization" ON "operation_step" ("organizationId")`);
		// A retried step cannot be duplicated, and the execution order is read from this table.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_operation_step" ON "operation_step" ("operationId", "name") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_step_order" ON "operation_step" ("operationId", "order")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_step_status" ON "operation_step" ("status") WHERE "status" IN ('PENDING','RUNNING')`
		);
		// A step cannot outlive its operation, and deleting the operation is the only way to remove it.
		await queryRunner.query(
			`ALTER TABLE "operation_step" ADD CONSTRAINT "FK_operation_step_operation" FOREIGN KEY ("operationId") REFERENCES "operation"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "operation_step" DROP CONSTRAINT "FK_operation_step_operation"`);
		await queryRunner.query(`ALTER TABLE "operation" DROP CONSTRAINT "FK_operation_parent"`);
		await queryRunner.query(`DROP TABLE "operation_step"`);
		await queryRunner.query(`DROP TABLE "operation"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "operation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar(64) NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "input" text NOT NULL DEFAULT ('{}'), "state" text, "result" text, "attemptCount" integer NOT NULL DEFAULT (0), "maxAttempts" integer NOT NULL DEFAULT (3), "lastError" text, "idempotencyKey" varchar(255), "parentOperationId" varchar, "startedAt" datetime, "finishedAt" datetime, "deadlineAt" datetime, "aggregateType" varchar(64), "aggregateId" varchar, "correlationId" varchar, CONSTRAINT "FK_operation_parent" FOREIGN KEY ("parentOperationId") REFERENCES "operation" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_operation_created_by_user" ON "operation" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_updated_by_user" ON "operation" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_deleted_by_user" ON "operation" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_is_active" ON "operation" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_is_archived" ON "operation" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_tenant" ON "operation" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_organization" ON "operation" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_status_avail" ON "operation" ("status", "createdAt") WHERE "status" IN ('PENDING','RUNNING')`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_org_type" ON "operation" ("organizationId", "type", "createdAt") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_deadline" ON "operation" ("deadlineAt") WHERE "deadlineAt" IS NOT NULL AND "status" IN ('PENDING','RUNNING','COMPENSATING')`
		);
		await queryRunner.query(`CREATE INDEX "IDX_operation_parent" ON "operation" ("parentOperationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_correlation" ON "operation" ("correlationId") WHERE "correlationId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_operation_idem" ON "operation" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_operation_aggregate_live" ON "operation" ("aggregateType", "aggregateId") WHERE "aggregateType" IS NOT NULL AND "status" IN ('PENDING','RUNNING','COMPENSATING') AND "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "operation_step" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "operationId" varchar NOT NULL, "name" varchar(64) NOT NULL, "order" integer NOT NULL, "status" varchar NOT NULL DEFAULT ('PENDING'), "input" text, "output" text, "compensationData" text, "attemptCount" integer NOT NULL DEFAULT (0), "lastError" text, "startedAt" datetime, "finishedAt" datetime, CONSTRAINT "FK_operation_step_operation" FOREIGN KEY ("operationId") REFERENCES "operation" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_created_by_user" ON "operation_step" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_updated_by_user" ON "operation_step" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_deleted_by_user" ON "operation_step" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_is_active" ON "operation_step" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_is_archived" ON "operation_step" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_tenant" ON "operation_step" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_operation_step_organization" ON "operation_step" ("organizationId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_operation_step" ON "operation_step" ("operationId", "name") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_step_order" ON "operation_step" ("operationId", "order")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_operation_step_status" ON "operation_step" ("status") WHERE "status" IN ('PENDING','RUNNING')`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_operation_step_status"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_order"`);
		await queryRunner.query(`DROP INDEX "UQ_operation_step"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_step_created_by_user"`);
		await queryRunner.query(`DROP TABLE "operation_step"`);

		await queryRunner.query(`DROP INDEX "UQ_operation_aggregate_live"`);
		await queryRunner.query(`DROP INDEX "UQ_operation_idem"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_correlation"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_parent"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_deadline"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_org_type"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_status_avail"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_operation_created_by_user"`);
		await queryRunner.query(`DROP TABLE "operation"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`operation\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`type\` varchar(64) NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`input\` json NOT NULL, \`state\` json NULL, \`result\` json NULL, \`attemptCount\` int NOT NULL DEFAULT 0, \`maxAttempts\` int NOT NULL DEFAULT 3, \`lastError\` text NULL, \`idempotencyKey\` varchar(255) NULL, \`parentOperationId\` varchar(36) NULL, \`startedAt\` datetime NULL, \`finishedAt\` datetime NULL, \`deadlineAt\` datetime NULL, \`aggregateType\` varchar(64) NULL, \`aggregateId\` varchar(36) NULL, \`correlationId\` varchar(36) NULL, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_operation_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_operation_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_operation_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_operation_is_active\` (\`isActive\`), INDEX \`IDX_operation_is_archived\` (\`isArchived\`), INDEX \`IDX_operation_tenant\` (\`tenantId\`), INDEX \`IDX_operation_organization\` (\`organizationId\`), INDEX \`IDX_operation_status_avail\` (\`status\`, \`createdAt\`), INDEX \`IDX_operation_org_type\` (\`organizationId\`, \`type\`, \`createdAt\`), INDEX \`IDX_operation_deadline\` (\`deadlineAt\`), INDEX \`IDX_operation_parent\` (\`parentOperationId\`), INDEX \`IDX_operation_correlation\` (\`correlationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// `organizationKey` folds the null organization, which a raw `organizationId` would have left
		// out of the rule altogether on every dialect, and `deletedKey` carries `"deletedAt" IS NULL`.
		// `idempotencyKey` stays raw on purpose: it is already a member of this tuple, so MySQL's own
		// null rule excuses the operations that carry no key — which is what `WHERE "idempotencyKey"
		// IS NOT NULL` does on the other two dialects.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_operation_idem\` ON \`operation\` (\`organizationKey\`, \`type\`, \`idempotencyKey\`, \`deletedKey\`)`
		);
		// The live-aggregate rule is not carried by an index on this dialect. "Status is one of three
		// values" is expressible here — a stored generated key of the shape this set uses elsewhere
		// would encode it — but no such index is created yet, so the rule is enforced by the operation
		// service inside the writing transaction and the schema-uniqueness reconciliation job reports
		// any violation it finds. Postgres and SQLite carry it as a partial index.
		await queryRunner.query(
			`ALTER TABLE \`operation\` ADD CONSTRAINT \`FK_operation_parent\` FOREIGN KEY (\`parentOperationId\`) REFERENCES \`operation\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`operation_step\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`operationId\` varchar(36) NOT NULL, \`name\` varchar(64) NOT NULL, \`order\` int NOT NULL, \`status\` varchar(255) NOT NULL DEFAULT 'PENDING', \`input\` json NULL, \`output\` json NULL, \`compensationData\` json NULL, \`attemptCount\` int NOT NULL DEFAULT 0, \`lastError\` text NULL, \`startedAt\` datetime NULL, \`finishedAt\` datetime NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_operation_step_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_operation_step_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_operation_step_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_operation_step_is_active\` (\`isActive\`), INDEX \`IDX_operation_step_is_archived\` (\`isArchived\`), INDEX \`IDX_operation_step_tenant\` (\`tenantId\`), INDEX \`IDX_operation_step_organization\` (\`organizationId\`), INDEX \`IDX_operation_step_order\` (\`operationId\`, \`order\`), INDEX \`IDX_operation_step_status\` (\`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_operation_step\` ON \`operation_step\` (\`operationId\`, \`name\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`operation_step\` ADD CONSTRAINT \`FK_operation_step_operation\` FOREIGN KEY (\`operationId\`) REFERENCES \`operation\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`operation_step\` DROP FOREIGN KEY \`FK_operation_step_operation\``);
		await queryRunner.query(`ALTER TABLE \`operation\` DROP FOREIGN KEY \`FK_operation_parent\``);
		await queryRunner.query(`DROP TABLE \`operation_step\``);
		await queryRunner.query(`DROP TABLE \`operation\``);
	}
}
