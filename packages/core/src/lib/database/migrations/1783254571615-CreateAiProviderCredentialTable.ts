import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateAiProviderCredentialTable1783254571615 implements MigrationInterface {
	name = 'CreateAiProviderCredentialTable1783254571615';

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
			`CREATE TABLE "ai_provider_credential" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "providerId" character varying NOT NULL, "apiKey" text, "baseUrl" character varying, "enabled" boolean NOT NULL DEFAULT true, "isDefault" boolean NOT NULL DEFAULT false, "defaultModel" character varying, CONSTRAINT "PK_ff8dcfd873bfb854530888b36bc" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_91d67d330af8977f70ef04621c" ON "ai_provider_credential" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_75e914e1e807641505d7087b5f" ON "ai_provider_credential" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d8699f7283e0e764834e621e0e" ON "ai_provider_credential" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_451dff655a76072657f52207f2" ON "ai_provider_credential" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_42a6490d37783e35fbe44a52f6" ON "ai_provider_credential" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3ff5f4914d7180d24c81328b7d" ON "ai_provider_credential" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_506bd348f082e306fa106c31f3" ON "ai_provider_credential" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_823fa39165adc2223792a02e4a" ON "ai_provider_credential" ("providerId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_ai_provider_credential_tenant_provider" ON "ai_provider_credential" ("tenantId", "providerId") `
		);
		await queryRunner.query(
			`ALTER TABLE "ai_provider_credential" ADD CONSTRAINT "FK_91d67d330af8977f70ef04621c1" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_provider_credential" ADD CONSTRAINT "FK_75e914e1e807641505d7087b5f2" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_provider_credential" ADD CONSTRAINT "FK_d8699f7283e0e764834e621e0eb" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_provider_credential" ADD CONSTRAINT "FK_3ff5f4914d7180d24c81328b7df" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_provider_credential" ADD CONSTRAINT "FK_506bd348f082e306fa106c31f3b" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP CONSTRAINT "FK_506bd348f082e306fa106c31f3b"`);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP CONSTRAINT "FK_3ff5f4914d7180d24c81328b7df"`);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP CONSTRAINT "FK_d8699f7283e0e764834e621e0eb"`);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP CONSTRAINT "FK_75e914e1e807641505d7087b5f2"`);
		await queryRunner.query(`ALTER TABLE "ai_provider_credential" DROP CONSTRAINT "FK_91d67d330af8977f70ef04621c1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_823fa39165adc2223792a02e4a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_506bd348f082e306fa106c31f3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3ff5f4914d7180d24c81328b7d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_42a6490d37783e35fbe44a52f6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_451dff655a76072657f52207f2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d8699f7283e0e764834e621e0e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_75e914e1e807641505d7087b5f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_91d67d330af8977f70ef04621c"`);
		await queryRunner.query(`DROP TABLE "ai_provider_credential"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "ai_provider_credential" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "providerId" varchar NOT NULL, "apiKey" text, "baseUrl" varchar, "enabled" boolean NOT NULL DEFAULT (1), "isDefault" boolean NOT NULL DEFAULT (0), "defaultModel" varchar, CONSTRAINT "FK_91d67d330af8977f70ef04621c1" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_75e914e1e807641505d7087b5f2" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d8699f7283e0e764834e621e0eb" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3ff5f4914d7180d24c81328b7df" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_506bd348f082e306fa106c31f3b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_91d67d330af8977f70ef04621c" ON "ai_provider_credential" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_75e914e1e807641505d7087b5f" ON "ai_provider_credential" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d8699f7283e0e764834e621e0e" ON "ai_provider_credential" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_451dff655a76072657f52207f2" ON "ai_provider_credential" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_42a6490d37783e35fbe44a52f6" ON "ai_provider_credential" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3ff5f4914d7180d24c81328b7d" ON "ai_provider_credential" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_506bd348f082e306fa106c31f3" ON "ai_provider_credential" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_823fa39165adc2223792a02e4a" ON "ai_provider_credential" ("providerId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_ai_provider_credential_tenant_provider" ON "ai_provider_credential" ("tenantId", "providerId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_823fa39165adc2223792a02e4a"`);
		await queryRunner.query(`DROP INDEX "IDX_506bd348f082e306fa106c31f3"`);
		await queryRunner.query(`DROP INDEX "IDX_3ff5f4914d7180d24c81328b7d"`);
		await queryRunner.query(`DROP INDEX "IDX_42a6490d37783e35fbe44a52f6"`);
		await queryRunner.query(`DROP INDEX "IDX_451dff655a76072657f52207f2"`);
		await queryRunner.query(`DROP INDEX "IDX_d8699f7283e0e764834e621e0e"`);
		await queryRunner.query(`DROP INDEX "IDX_75e914e1e807641505d7087b5f"`);
		await queryRunner.query(`DROP INDEX "IDX_91d67d330af8977f70ef04621c"`);
		await queryRunner.query(`DROP TABLE "ai_provider_credential"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`ai_provider_credential\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`providerId\` varchar(255) NOT NULL, \`apiKey\` text NULL, \`baseUrl\` varchar(255) NULL, \`enabled\` tinyint NOT NULL DEFAULT 1, \`isDefault\` tinyint NOT NULL DEFAULT 0, \`defaultModel\` varchar(255) NULL, INDEX \`IDX_91d67d330af8977f70ef04621c\` (\`createdByUserId\`), INDEX \`IDX_75e914e1e807641505d7087b5f\` (\`updatedByUserId\`), INDEX \`IDX_d8699f7283e0e764834e621e0e\` (\`deletedByUserId\`), INDEX \`IDX_451dff655a76072657f52207f2\` (\`isActive\`), INDEX \`IDX_42a6490d37783e35fbe44a52f6\` (\`isArchived\`), INDEX \`IDX_3ff5f4914d7180d24c81328b7d\` (\`tenantId\`), INDEX \`IDX_506bd348f082e306fa106c31f3\` (\`organizationId\`), INDEX \`IDX_823fa39165adc2223792a02e4a\` (\`providerId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_ai_provider_credential_tenant_provider\` ON \`ai_provider_credential\` (\`tenantId\`, \`providerId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_provider_credential\` ADD CONSTRAINT \`FK_91d67d330af8977f70ef04621c1\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_provider_credential\` ADD CONSTRAINT \`FK_75e914e1e807641505d7087b5f2\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_provider_credential\` ADD CONSTRAINT \`FK_d8699f7283e0e764834e621e0eb\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_provider_credential\` ADD CONSTRAINT \`FK_3ff5f4914d7180d24c81328b7df\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_provider_credential\` ADD CONSTRAINT \`FK_506bd348f082e306fa106c31f3b\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` DROP FOREIGN KEY \`FK_506bd348f082e306fa106c31f3b\``);
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` DROP FOREIGN KEY \`FK_3ff5f4914d7180d24c81328b7df\``);
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` DROP FOREIGN KEY \`FK_d8699f7283e0e764834e621e0eb\``);
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` DROP FOREIGN KEY \`FK_75e914e1e807641505d7087b5f2\``);
		await queryRunner.query(`ALTER TABLE \`ai_provider_credential\` DROP FOREIGN KEY \`FK_91d67d330af8977f70ef04621c1\``);
		await queryRunner.query(`DROP INDEX \`IDX_823fa39165adc2223792a02e4a\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP INDEX \`IDX_506bd348f082e306fa106c31f3\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP INDEX \`IDX_3ff5f4914d7180d24c81328b7d\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP INDEX \`IDX_42a6490d37783e35fbe44a52f6\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP INDEX \`IDX_451dff655a76072657f52207f2\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP INDEX \`IDX_d8699f7283e0e764834e621e0e\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP INDEX \`IDX_75e914e1e807641505d7087b5f\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP INDEX \`IDX_91d67d330af8977f70ef04621c\` ON \`ai_provider_credential\``);
		await queryRunner.query(`DROP TABLE \`ai_provider_credential\``);
	}
}
