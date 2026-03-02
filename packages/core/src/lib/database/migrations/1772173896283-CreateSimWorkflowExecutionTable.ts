import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateSimWorkflowExecutionTable1772173896283 implements MigrationInterface {
	name = 'CreateSimWorkflowExecutionTable1772173896283';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
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

		switch (queryRunner.connection.options.type) {
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
		await queryRunner.query(`CREATE TABLE "integration_sim_workflow_execution" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "workflowId" character varying NOT NULL, "executionId" character varying, "status" character varying NOT NULL, "input" json, "output" json, "error" json, "duration" integer, "triggeredBy" character varying, "integrationId" uuid, CONSTRAINT "PK_85a9360870f866a6e73016d3304" PRIMARY KEY ("id"))`);
		await queryRunner.query(`CREATE INDEX "IDX_e830e6c6e890fde77baa13d1b9" ON "integration_sim_workflow_execution" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_76e1b8edabd8a98090931e9a0f" ON "integration_sim_workflow_execution" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4f41cd27b1be0a3d7b96b856c" ON "integration_sim_workflow_execution" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_368ae7398fc5d6396b28d89dea" ON "integration_sim_workflow_execution" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0669719993bae8e31bb829446" ON "integration_sim_workflow_execution" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_739faa38414e8bf6f5b4b418f1" ON "integration_sim_workflow_execution" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b35e4424b51c7b8127e448310d" ON "integration_sim_workflow_execution" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_36e8d2d032cfbff60d21ce98bc" ON "integration_sim_workflow_execution" ("workflowId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3dd3ba7dd0b707fec566d25f83" ON "integration_sim_workflow_execution" ("executionId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cd2c8d035bfd5547bc6174500f" ON "integration_sim_workflow_execution" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf37d62fdb657af05e7d702cb0" ON "integration_sim_workflow_execution" ("integrationId") `);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_e830e6c6e890fde77baa13d1b9d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_76e1b8edabd8a98090931e9a0f8" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_b4f41cd27b1be0a3d7b96b856c9" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_739faa38414e8bf6f5b4b418f1d" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_b35e4424b51c7b8127e448310da" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_cf37d62fdb657af05e7d702cb04" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_cf37d62fdb657af05e7d702cb04"`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_b35e4424b51c7b8127e448310da"`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_739faa38414e8bf6f5b4b418f1d"`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_b4f41cd27b1be0a3d7b96b856c9"`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_76e1b8edabd8a98090931e9a0f8"`);
		await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_e830e6c6e890fde77baa13d1b9d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cf37d62fdb657af05e7d702cb0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cd2c8d035bfd5547bc6174500f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3dd3ba7dd0b707fec566d25f83"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_36e8d2d032cfbff60d21ce98bc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b35e4424b51c7b8127e448310d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_739faa38414e8bf6f5b4b418f1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c0669719993bae8e31bb829446"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_368ae7398fc5d6396b28d89dea"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b4f41cd27b1be0a3d7b96b856c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_76e1b8edabd8a98090931e9a0f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e830e6c6e890fde77baa13d1b9"`);
		await queryRunner.query(`DROP TABLE "integration_sim_workflow_execution"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE TABLE "integration_sim_workflow_execution" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "workflowId" varchar NOT NULL, "executionId" varchar, "status" varchar NOT NULL, "input" text, "output" text, "error" text, "duration" integer, "triggeredBy" varchar, "integrationId" varchar, CONSTRAINT "FK_e830e6c6e890fde77baa13d1b9d" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_76e1b8edabd8a98090931e9a0f8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b4f41cd27b1be0a3d7b96b856c9" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_739faa38414e8bf6f5b4b418f1d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b35e4424b51c7b8127e448310da" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_cf37d62fdb657af05e7d702cb04" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
		await queryRunner.query(`CREATE INDEX "IDX_e830e6c6e890fde77baa13d1b9" ON "integration_sim_workflow_execution" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_76e1b8edabd8a98090931e9a0f" ON "integration_sim_workflow_execution" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4f41cd27b1be0a3d7b96b856c" ON "integration_sim_workflow_execution" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_368ae7398fc5d6396b28d89dea" ON "integration_sim_workflow_execution" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0669719993bae8e31bb829446" ON "integration_sim_workflow_execution" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_739faa38414e8bf6f5b4b418f1" ON "integration_sim_workflow_execution" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b35e4424b51c7b8127e448310d" ON "integration_sim_workflow_execution" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_36e8d2d032cfbff60d21ce98bc" ON "integration_sim_workflow_execution" ("workflowId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3dd3ba7dd0b707fec566d25f83" ON "integration_sim_workflow_execution" ("executionId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cd2c8d035bfd5547bc6174500f" ON "integration_sim_workflow_execution" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf37d62fdb657af05e7d702cb0" ON "integration_sim_workflow_execution" ("integrationId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_cf37d62fdb657af05e7d702cb0"`);
		await queryRunner.query(`DROP INDEX "IDX_cd2c8d035bfd5547bc6174500f"`);
		await queryRunner.query(`DROP INDEX "IDX_3dd3ba7dd0b707fec566d25f83"`);
		await queryRunner.query(`DROP INDEX "IDX_36e8d2d032cfbff60d21ce98bc"`);
		await queryRunner.query(`DROP INDEX "IDX_b35e4424b51c7b8127e448310d"`);
		await queryRunner.query(`DROP INDEX "IDX_739faa38414e8bf6f5b4b418f1"`);
		await queryRunner.query(`DROP INDEX "IDX_c0669719993bae8e31bb829446"`);
		await queryRunner.query(`DROP INDEX "IDX_368ae7398fc5d6396b28d89dea"`);
		await queryRunner.query(`DROP INDEX "IDX_b4f41cd27b1be0a3d7b96b856c"`);
		await queryRunner.query(`DROP INDEX "IDX_76e1b8edabd8a98090931e9a0f"`);
		await queryRunner.query(`DROP INDEX "IDX_e830e6c6e890fde77baa13d1b9"`);
		await queryRunner.query(`DROP TABLE "integration_sim_workflow_execution"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE TABLE \`integration_sim_workflow_execution\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`workflowId\` varchar(255) NOT NULL, \`executionId\` varchar(255) NULL, \`status\` varchar(255) NOT NULL, \`input\` json NULL, \`output\` json NULL, \`error\` json NULL, \`duration\` int NULL, \`triggeredBy\` varchar(255) NULL, \`integrationId\` varchar(255) NULL, INDEX \`IDX_e830e6c6e890fde77baa13d1b9\` (\`createdByUserId\`), INDEX \`IDX_76e1b8edabd8a98090931e9a0f\` (\`updatedByUserId\`), INDEX \`IDX_b4f41cd27b1be0a3d7b96b856c\` (\`deletedByUserId\`), INDEX \`IDX_368ae7398fc5d6396b28d89dea\` (\`isActive\`), INDEX \`IDX_c0669719993bae8e31bb829446\` (\`isArchived\`), INDEX \`IDX_739faa38414e8bf6f5b4b418f1\` (\`tenantId\`), INDEX \`IDX_b35e4424b51c7b8127e448310d\` (\`organizationId\`), INDEX \`IDX_36e8d2d032cfbff60d21ce98bc\` (\`workflowId\`), INDEX \`IDX_3dd3ba7dd0b707fec566d25f83\` (\`executionId\`), INDEX \`IDX_cd2c8d035bfd5547bc6174500f\` (\`status\`), INDEX \`IDX_cf37d62fdb657af05e7d702cb0\` (\`integrationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` ADD CONSTRAINT \`FK_e830e6c6e890fde77baa13d1b9d\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` ADD CONSTRAINT \`FK_76e1b8edabd8a98090931e9a0f8\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` ADD CONSTRAINT \`FK_b4f41cd27b1be0a3d7b96b856c9\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` ADD CONSTRAINT \`FK_739faa38414e8bf6f5b4b418f1d\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` ADD CONSTRAINT \`FK_b35e4424b51c7b8127e448310da\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` ADD CONSTRAINT \`FK_cf37d62fdb657af05e7d702cb04\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration_tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` DROP FOREIGN KEY \`FK_cf37d62fdb657af05e7d702cb04\``);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` DROP FOREIGN KEY \`FK_b35e4424b51c7b8127e448310da\``);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` DROP FOREIGN KEY \`FK_739faa38414e8bf6f5b4b418f1d\``);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` DROP FOREIGN KEY \`FK_b4f41cd27b1be0a3d7b96b856c9\``);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` DROP FOREIGN KEY \`FK_76e1b8edabd8a98090931e9a0f8\``);
		await queryRunner.query(`ALTER TABLE \`integration_sim_workflow_execution\` DROP FOREIGN KEY \`FK_e830e6c6e890fde77baa13d1b9d\``);
		await queryRunner.query(`DROP INDEX \`IDX_cf37d62fdb657af05e7d702cb0\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_cd2c8d035bfd5547bc6174500f\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_3dd3ba7dd0b707fec566d25f83\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_36e8d2d032cfbff60d21ce98bc\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_b35e4424b51c7b8127e448310d\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_739faa38414e8bf6f5b4b418f1\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_c0669719993bae8e31bb829446\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_368ae7398fc5d6396b28d89dea\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_b4f41cd27b1be0a3d7b96b856c\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_76e1b8edabd8a98090931e9a0f\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP INDEX \`IDX_e830e6c6e890fde77baa13d1b9\` ON \`integration_sim_workflow_execution\``);
		await queryRunner.query(`DROP TABLE \`integration_sim_workflow_execution\``);
	}
}
