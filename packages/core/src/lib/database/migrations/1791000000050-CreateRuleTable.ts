import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the single rule table.
 *
 * One table drives every conditional behaviour on the platform — price-list eligibility, price
 * conditions, promotion conditions, promotion buy and target selection, shipping eligibility and
 * pricing, tax narrowing, segment membership, payment-provider availability, fulfilment availability,
 * stock-allocation constraints and approval routing — so it is part of the platform kernel rather than
 * of any one capability. The indexes are the three access paths the evaluator and the rule builder
 * actually use, and they are partial on `deletedAt` because a soft-deleted rule is never read.
 */
export class CreateRuleTable1791000000050 implements MigrationInterface {
	name = 'CreateRuleTable1791000000050';

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
			`CREATE TABLE "rule" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "ownerType" character varying(32) NOT NULL DEFAULT 'COLLECTION', "ownerId" uuid NOT NULL, "scope" character varying(16) NOT NULL DEFAULT 'ORDER', "attribute" character varying(128) NOT NULL, "operator" character varying(16) NOT NULL DEFAULT 'EQ', "value" jsonb, "valueType" character varying(16) NOT NULL DEFAULT 'STRING', "isNegated" boolean NOT NULL DEFAULT false, "groupIndex" integer NOT NULL DEFAULT 0, "priority" integer NOT NULL DEFAULT 0, "description" character varying(255), CONSTRAINT "PK_rule_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_rule_created_by_user" ON "rule" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_updated_by_user" ON "rule" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_deleted_by_user" ON "rule" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_is_active" ON "rule" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_is_archived" ON "rule" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_tenant" ON "rule" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_organization" ON "rule" ("organizationId")`);
		// The three paths the platform actually reads: an owner's rules in evaluation order, an attribute
		// across owners (the rule builder's "where is this used"), and one scope of one owner.
		await queryRunner.query(
			`CREATE INDEX "IDX_rule_owner" ON "rule" ("ownerType", "ownerId", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_rule_attribute" ON "rule" ("attribute") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_rule_owner_scope" ON "rule" ("ownerType", "ownerId", "scope", "groupIndex") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "rule"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "rule" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "ownerType" varchar NOT NULL DEFAULT ('COLLECTION'), "ownerId" varchar NOT NULL, "scope" varchar NOT NULL DEFAULT ('ORDER'), "attribute" varchar NOT NULL, "operator" varchar NOT NULL DEFAULT ('EQ'), "value" text, "valueType" varchar NOT NULL DEFAULT ('STRING'), "isNegated" boolean NOT NULL DEFAULT (0), "groupIndex" integer NOT NULL DEFAULT (0), "priority" integer NOT NULL DEFAULT (0), "description" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_rule_created_by_user" ON "rule" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_updated_by_user" ON "rule" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_deleted_by_user" ON "rule" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_is_active" ON "rule" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_is_archived" ON "rule" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_tenant" ON "rule" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_rule_organization" ON "rule" ("organizationId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_rule_owner" ON "rule" ("ownerType", "ownerId", "priority") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_rule_attribute" ON "rule" ("attribute") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_rule_owner_scope" ON "rule" ("ownerType", "ownerId", "scope", "groupIndex") WHERE "deletedAt" IS NULL`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_rule_owner_scope"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_attribute"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_owner"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_organization"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_tenant"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_is_archived"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_is_active"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_deleted_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_updated_by_user"`);
		await queryRunner.query(`DROP INDEX "IDX_rule_created_by_user"`);
		await queryRunner.query(`DROP TABLE "rule"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`rule\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`ownerType\` varchar(32) NOT NULL DEFAULT 'COLLECTION', \`ownerId\` varchar(36) NOT NULL, \`scope\` varchar(16) NOT NULL DEFAULT 'ORDER', \`attribute\` varchar(128) NOT NULL, \`operator\` varchar(16) NOT NULL DEFAULT 'EQ', \`value\` json NULL, \`valueType\` varchar(16) NOT NULL DEFAULT 'STRING', \`isNegated\` tinyint NOT NULL DEFAULT 0, \`groupIndex\` int NOT NULL DEFAULT 0, \`priority\` int NOT NULL DEFAULT 0, \`description\` varchar(255) NULL, INDEX \`IDX_rule_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_rule_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_rule_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_rule_is_active\` (\`isActive\`), INDEX \`IDX_rule_is_archived\` (\`isArchived\`), INDEX \`IDX_rule_tenant\` (\`tenantId\`), INDEX \`IDX_rule_organization\` (\`organizationId\`), INDEX \`IDX_rule_owner\` (\`ownerType\`, \`ownerId\`, \`priority\`), INDEX \`IDX_rule_attribute\` (\`attribute\`), INDEX \`IDX_rule_owner_scope\` (\`ownerType\`, \`ownerId\`, \`scope\`, \`groupIndex\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE \`rule\``);
	}
}
