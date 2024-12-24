import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateDashboardWidgetTable1735029860021 implements MigrationInterface {
	name = 'CreateDashboardWidgetTable1735029860021';

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
		await queryRunner.query(
			`CREATE TABLE "dashboard_widget" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "order" integer, "color" character varying, "isVisible" boolean, "options" jsonb, "size" jsonb, "dashboardId" uuid, "employeeId" uuid, "projectId" uuid, "organizationTeamId" uuid, CONSTRAINT "PK_d776e45a42322c53e9167b00ead" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_58393e814dbb0ad167d060af32" ON "dashboard_widget" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_f4597d1682e2a9bdc21ad1130b" ON "dashboard_widget" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_a7ffbc7d50b1a1b81b1fe536ef" ON "dashboard_widget" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_874c658642731879efcb59eb86" ON "dashboard_widget" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37493320a29e31ef5270a1a4cd" ON "dashboard_widget" ("dashboardId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2b7c8613b15d53b39b38ac1ec3" ON "dashboard_widget" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_76ce155efa0c89ce6aeda06e70" ON "dashboard_widget" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aca6bf2a4bb3d3e4fefb45025" ON "dashboard_widget" ("organizationTeamId") `
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_a7ffbc7d50b1a1b81b1fe536efa" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_874c658642731879efcb59eb86d" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_37493320a29e31ef5270a1a4cdb" FOREIGN KEY ("dashboardId") REFERENCES "dashboard"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_2b7c8613b15d53b39b38ac1ec35" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_76ce155efa0c89ce6aeda06e70c" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "dashboard_widget" ADD CONSTRAINT "FK_8aca6bf2a4bb3d3e4fefb45025e" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_8aca6bf2a4bb3d3e4fefb45025e"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_76ce155efa0c89ce6aeda06e70c"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_2b7c8613b15d53b39b38ac1ec35"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_37493320a29e31ef5270a1a4cdb"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_874c658642731879efcb59eb86d"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" DROP CONSTRAINT "FK_a7ffbc7d50b1a1b81b1fe536efa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8aca6bf2a4bb3d3e4fefb45025"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_76ce155efa0c89ce6aeda06e70"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2b7c8613b15d53b39b38ac1ec3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_37493320a29e31ef5270a1a4cd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_874c658642731879efcb59eb86"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a7ffbc7d50b1a1b81b1fe536ef"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f4597d1682e2a9bdc21ad1130b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_58393e814dbb0ad167d060af32"`);
		await queryRunner.query(`DROP TABLE "dashboard_widget"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "dashboard_widget" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "order" integer, "color" varchar, "isVisible" boolean, "options" text, "size" text, "dashboardId" varchar, "employeeId" varchar, "projectId" varchar, "organizationTeamId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_58393e814dbb0ad167d060af32" ON "dashboard_widget" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_f4597d1682e2a9bdc21ad1130b" ON "dashboard_widget" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_a7ffbc7d50b1a1b81b1fe536ef" ON "dashboard_widget" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_874c658642731879efcb59eb86" ON "dashboard_widget" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37493320a29e31ef5270a1a4cd" ON "dashboard_widget" ("dashboardId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2b7c8613b15d53b39b38ac1ec3" ON "dashboard_widget" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_76ce155efa0c89ce6aeda06e70" ON "dashboard_widget" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aca6bf2a4bb3d3e4fefb45025" ON "dashboard_widget" ("organizationTeamId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_58393e814dbb0ad167d060af32"`);
		await queryRunner.query(`DROP INDEX "IDX_f4597d1682e2a9bdc21ad1130b"`);
		await queryRunner.query(`DROP INDEX "IDX_a7ffbc7d50b1a1b81b1fe536ef"`);
		await queryRunner.query(`DROP INDEX "IDX_874c658642731879efcb59eb86"`);
		await queryRunner.query(`DROP INDEX "IDX_37493320a29e31ef5270a1a4cd"`);
		await queryRunner.query(`DROP INDEX "IDX_2b7c8613b15d53b39b38ac1ec3"`);
		await queryRunner.query(`DROP INDEX "IDX_76ce155efa0c89ce6aeda06e70"`);
		await queryRunner.query(`DROP INDEX "IDX_8aca6bf2a4bb3d3e4fefb45025"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_dashboard_widget" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "order" integer, "color" varchar, "isVisible" boolean, "options" text, "size" text, "dashboardId" varchar, "employeeId" varchar, "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_a7ffbc7d50b1a1b81b1fe536efa" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_874c658642731879efcb59eb86d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_37493320a29e31ef5270a1a4cdb" FOREIGN KEY ("dashboardId") REFERENCES "dashboard" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2b7c8613b15d53b39b38ac1ec35" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_76ce155efa0c89ce6aeda06e70c" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8aca6bf2a4bb3d3e4fefb45025e" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_dashboard_widget"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "order", "color", "isVisible", "options", "size", "dashboardId", "employeeId", "projectId", "organizationTeamId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "order", "color", "isVisible", "options", "size", "dashboardId", "employeeId", "projectId", "organizationTeamId" FROM "dashboard_widget"`
		);
		await queryRunner.query(`DROP TABLE "dashboard_widget"`);
		await queryRunner.query(`ALTER TABLE "temporary_dashboard_widget" RENAME TO "dashboard_widget"`);
		await queryRunner.query(`CREATE INDEX "IDX_58393e814dbb0ad167d060af32" ON "dashboard_widget" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_f4597d1682e2a9bdc21ad1130b" ON "dashboard_widget" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_a7ffbc7d50b1a1b81b1fe536ef" ON "dashboard_widget" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_874c658642731879efcb59eb86" ON "dashboard_widget" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37493320a29e31ef5270a1a4cd" ON "dashboard_widget" ("dashboardId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2b7c8613b15d53b39b38ac1ec3" ON "dashboard_widget" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_76ce155efa0c89ce6aeda06e70" ON "dashboard_widget" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aca6bf2a4bb3d3e4fefb45025" ON "dashboard_widget" ("organizationTeamId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_8aca6bf2a4bb3d3e4fefb45025"`);
		await queryRunner.query(`DROP INDEX "IDX_76ce155efa0c89ce6aeda06e70"`);
		await queryRunner.query(`DROP INDEX "IDX_2b7c8613b15d53b39b38ac1ec3"`);
		await queryRunner.query(`DROP INDEX "IDX_37493320a29e31ef5270a1a4cd"`);
		await queryRunner.query(`DROP INDEX "IDX_874c658642731879efcb59eb86"`);
		await queryRunner.query(`DROP INDEX "IDX_a7ffbc7d50b1a1b81b1fe536ef"`);
		await queryRunner.query(`DROP INDEX "IDX_f4597d1682e2a9bdc21ad1130b"`);
		await queryRunner.query(`DROP INDEX "IDX_58393e814dbb0ad167d060af32"`);
		await queryRunner.query(`ALTER TABLE "dashboard_widget" RENAME TO "temporary_dashboard_widget"`);
		await queryRunner.query(
			`CREATE TABLE "dashboard_widget" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "order" integer, "color" varchar, "isVisible" boolean, "options" text, "size" text, "dashboardId" varchar, "employeeId" varchar, "projectId" varchar, "organizationTeamId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "dashboard_widget"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "order", "color", "isVisible", "options", "size", "dashboardId", "employeeId", "projectId", "organizationTeamId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "order", "color", "isVisible", "options", "size", "dashboardId", "employeeId", "projectId", "organizationTeamId" FROM "temporary_dashboard_widget"`
		);
		await queryRunner.query(`DROP TABLE "temporary_dashboard_widget"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aca6bf2a4bb3d3e4fefb45025" ON "dashboard_widget" ("organizationTeamId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_76ce155efa0c89ce6aeda06e70" ON "dashboard_widget" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2b7c8613b15d53b39b38ac1ec3" ON "dashboard_widget" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_37493320a29e31ef5270a1a4cd" ON "dashboard_widget" ("dashboardId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_874c658642731879efcb59eb86" ON "dashboard_widget" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a7ffbc7d50b1a1b81b1fe536ef" ON "dashboard_widget" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f4597d1682e2a9bdc21ad1130b" ON "dashboard_widget" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_58393e814dbb0ad167d060af32" ON "dashboard_widget" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_8aca6bf2a4bb3d3e4fefb45025"`);
		await queryRunner.query(`DROP INDEX "IDX_76ce155efa0c89ce6aeda06e70"`);
		await queryRunner.query(`DROP INDEX "IDX_2b7c8613b15d53b39b38ac1ec3"`);
		await queryRunner.query(`DROP INDEX "IDX_37493320a29e31ef5270a1a4cd"`);
		await queryRunner.query(`DROP INDEX "IDX_874c658642731879efcb59eb86"`);
		await queryRunner.query(`DROP INDEX "IDX_a7ffbc7d50b1a1b81b1fe536ef"`);
		await queryRunner.query(`DROP INDEX "IDX_f4597d1682e2a9bdc21ad1130b"`);
		await queryRunner.query(`DROP INDEX "IDX_58393e814dbb0ad167d060af32"`);
		await queryRunner.query(`DROP TABLE "dashboard_widget"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`dashboard_widget\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`order\` int NULL, \`color\` varchar(255) NULL, \`isVisible\` tinyint NULL, \`options\` json NULL, \`size\` json NULL, \`dashboardId\` varchar(255) NULL, \`employeeId\` varchar(255) NULL, \`projectId\` varchar(255) NULL, \`organizationTeamId\` varchar(255) NULL, INDEX \`IDX_58393e814dbb0ad167d060af32\` (\`isActive\`), INDEX \`IDX_f4597d1682e2a9bdc21ad1130b\` (\`isArchived\`), INDEX \`IDX_a7ffbc7d50b1a1b81b1fe536ef\` (\`tenantId\`), INDEX \`IDX_874c658642731879efcb59eb86\` (\`organizationId\`), INDEX \`IDX_37493320a29e31ef5270a1a4cd\` (\`dashboardId\`), INDEX \`IDX_2b7c8613b15d53b39b38ac1ec3\` (\`employeeId\`), INDEX \`IDX_76ce155efa0c89ce6aeda06e70\` (\`projectId\`), INDEX \`IDX_8aca6bf2a4bb3d3e4fefb45025\` (\`organizationTeamId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard_widget\` ADD CONSTRAINT \`FK_a7ffbc7d50b1a1b81b1fe536efa\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard_widget\` ADD CONSTRAINT \`FK_874c658642731879efcb59eb86d\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard_widget\` ADD CONSTRAINT \`FK_37493320a29e31ef5270a1a4cdb\` FOREIGN KEY (\`dashboardId\`) REFERENCES \`dashboard\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard_widget\` ADD CONSTRAINT \`FK_2b7c8613b15d53b39b38ac1ec35\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard_widget\` ADD CONSTRAINT \`FK_76ce155efa0c89ce6aeda06e70c\` FOREIGN KEY (\`projectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`dashboard_widget\` ADD CONSTRAINT \`FK_8aca6bf2a4bb3d3e4fefb45025e\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`dashboard_widget\` DROP FOREIGN KEY \`FK_8aca6bf2a4bb3d3e4fefb45025e\``);
		await queryRunner.query(`ALTER TABLE \`dashboard_widget\` DROP FOREIGN KEY \`FK_76ce155efa0c89ce6aeda06e70c\``);
		await queryRunner.query(`ALTER TABLE \`dashboard_widget\` DROP FOREIGN KEY \`FK_2b7c8613b15d53b39b38ac1ec35\``);
		await queryRunner.query(`ALTER TABLE \`dashboard_widget\` DROP FOREIGN KEY \`FK_37493320a29e31ef5270a1a4cdb\``);
		await queryRunner.query(`ALTER TABLE \`dashboard_widget\` DROP FOREIGN KEY \`FK_874c658642731879efcb59eb86d\``);
		await queryRunner.query(`ALTER TABLE \`dashboard_widget\` DROP FOREIGN KEY \`FK_a7ffbc7d50b1a1b81b1fe536efa\``);
		await queryRunner.query(`DROP INDEX \`IDX_8aca6bf2a4bb3d3e4fefb45025\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP INDEX \`IDX_76ce155efa0c89ce6aeda06e70\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP INDEX \`IDX_2b7c8613b15d53b39b38ac1ec3\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP INDEX \`IDX_37493320a29e31ef5270a1a4cd\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP INDEX \`IDX_874c658642731879efcb59eb86\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP INDEX \`IDX_a7ffbc7d50b1a1b81b1fe536ef\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP INDEX \`IDX_f4597d1682e2a9bdc21ad1130b\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP INDEX \`IDX_58393e814dbb0ad167d060af32\` ON \`dashboard_widget\``);
		await queryRunner.query(`DROP TABLE \`dashboard_widget\``);
	}
}
