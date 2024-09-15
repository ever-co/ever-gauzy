import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddFavoriteTable1725950092620 implements MigrationInterface {
	name = 'AddFavoriteTable1725950092620';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

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
			`CREATE TABLE "favorite" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "employeeId" uuid, CONSTRAINT "PK_495675cec4fb09666704e4f610f" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_8ab4c215a9b90395ce242d7cac" ON "favorite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_aac7859c7c93073a7fd990ab66" ON "favorite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_fd7fbcabed207b9f7398802738" ON "favorite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7e0f07d02bea087f84f271e9bf" ON "favorite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a8d924902879f0a3349678c86f" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4734abeedbb9c724c980f7f54" ON "favorite" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_59e3dbf9b24f9d1cb7534dbf17" ON "favorite" ("employeeId") `);
		await queryRunner.query(
			`ALTER TABLE "favorite" ADD CONSTRAINT "FK_fd7fbcabed207b9f7398802738e" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "favorite" ADD CONSTRAINT "FK_7e0f07d02bea087f84f271e9bf4" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "favorite" ADD CONSTRAINT "FK_59e3dbf9b24f9d1cb7534dbf177" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "favorite" DROP CONSTRAINT "FK_59e3dbf9b24f9d1cb7534dbf177"`);
		await queryRunner.query(`ALTER TABLE "favorite" DROP CONSTRAINT "FK_7e0f07d02bea087f84f271e9bf4"`);
		await queryRunner.query(`ALTER TABLE "favorite" DROP CONSTRAINT "FK_fd7fbcabed207b9f7398802738e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_59e3dbf9b24f9d1cb7534dbf17"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b4734abeedbb9c724c980f7f54"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a8d924902879f0a3349678c86f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7e0f07d02bea087f84f271e9bf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fd7fbcabed207b9f7398802738"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_aac7859c7c93073a7fd990ab66"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8ab4c215a9b90395ce242d7cac"`);
		await queryRunner.query(`DROP TABLE "favorite"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "favorite" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "employeeId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_8ab4c215a9b90395ce242d7cac" ON "favorite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_aac7859c7c93073a7fd990ab66" ON "favorite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_fd7fbcabed207b9f7398802738" ON "favorite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7e0f07d02bea087f84f271e9bf" ON "favorite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a8d924902879f0a3349678c86f" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4734abeedbb9c724c980f7f54" ON "favorite" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_59e3dbf9b24f9d1cb7534dbf17" ON "favorite" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_8ab4c215a9b90395ce242d7cac"`);
		await queryRunner.query(`DROP INDEX "IDX_aac7859c7c93073a7fd990ab66"`);
		await queryRunner.query(`DROP INDEX "IDX_fd7fbcabed207b9f7398802738"`);
		await queryRunner.query(`DROP INDEX "IDX_7e0f07d02bea087f84f271e9bf"`);
		await queryRunner.query(`DROP INDEX "IDX_a8d924902879f0a3349678c86f"`);
		await queryRunner.query(`DROP INDEX "IDX_b4734abeedbb9c724c980f7f54"`);
		await queryRunner.query(`DROP INDEX "IDX_59e3dbf9b24f9d1cb7534dbf17"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_favorite" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_fd7fbcabed207b9f7398802738e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7e0f07d02bea087f84f271e9bf4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_59e3dbf9b24f9d1cb7534dbf177" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_favorite"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "employeeId" FROM "favorite"`
		);
		await queryRunner.query(`DROP TABLE "favorite"`);
		await queryRunner.query(`ALTER TABLE "temporary_favorite" RENAME TO "favorite"`);
		await queryRunner.query(`CREATE INDEX "IDX_8ab4c215a9b90395ce242d7cac" ON "favorite" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_aac7859c7c93073a7fd990ab66" ON "favorite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_fd7fbcabed207b9f7398802738" ON "favorite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7e0f07d02bea087f84f271e9bf" ON "favorite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a8d924902879f0a3349678c86f" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4734abeedbb9c724c980f7f54" ON "favorite" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_59e3dbf9b24f9d1cb7534dbf17" ON "favorite" ("employeeId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_59e3dbf9b24f9d1cb7534dbf17"`);
		await queryRunner.query(`DROP INDEX "IDX_b4734abeedbb9c724c980f7f54"`);
		await queryRunner.query(`DROP INDEX "IDX_a8d924902879f0a3349678c86f"`);
		await queryRunner.query(`DROP INDEX "IDX_7e0f07d02bea087f84f271e9bf"`);
		await queryRunner.query(`DROP INDEX "IDX_fd7fbcabed207b9f7398802738"`);
		await queryRunner.query(`DROP INDEX "IDX_aac7859c7c93073a7fd990ab66"`);
		await queryRunner.query(`DROP INDEX "IDX_8ab4c215a9b90395ce242d7cac"`);
		await queryRunner.query(`ALTER TABLE "favorite" RENAME TO "temporary_favorite"`);
		await queryRunner.query(
			`CREATE TABLE "favorite" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "employeeId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "favorite"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "employeeId" FROM "temporary_favorite"`
		);
		await queryRunner.query(`DROP TABLE "temporary_favorite"`);
		await queryRunner.query(`CREATE INDEX "IDX_59e3dbf9b24f9d1cb7534dbf17" ON "favorite" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b4734abeedbb9c724c980f7f54" ON "favorite" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a8d924902879f0a3349678c86f" ON "favorite" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_7e0f07d02bea087f84f271e9bf" ON "favorite" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fd7fbcabed207b9f7398802738" ON "favorite" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_aac7859c7c93073a7fd990ab66" ON "favorite" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_8ab4c215a9b90395ce242d7cac" ON "favorite" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_59e3dbf9b24f9d1cb7534dbf17"`);
		await queryRunner.query(`DROP INDEX "IDX_b4734abeedbb9c724c980f7f54"`);
		await queryRunner.query(`DROP INDEX "IDX_a8d924902879f0a3349678c86f"`);
		await queryRunner.query(`DROP INDEX "IDX_7e0f07d02bea087f84f271e9bf"`);
		await queryRunner.query(`DROP INDEX "IDX_fd7fbcabed207b9f7398802738"`);
		await queryRunner.query(`DROP INDEX "IDX_aac7859c7c93073a7fd990ab66"`);
		await queryRunner.query(`DROP INDEX "IDX_8ab4c215a9b90395ce242d7cac"`);
		await queryRunner.query(`DROP TABLE "favorite"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`favorite\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_8ab4c215a9b90395ce242d7cac\` (\`isActive\`), INDEX \`IDX_aac7859c7c93073a7fd990ab66\` (\`isArchived\`), INDEX \`IDX_fd7fbcabed207b9f7398802738\` (\`tenantId\`), INDEX \`IDX_7e0f07d02bea087f84f271e9bf\` (\`organizationId\`), INDEX \`IDX_a8d924902879f0a3349678c86f\` (\`entity\`), INDEX \`IDX_b4734abeedbb9c724c980f7f54\` (\`entityId\`), INDEX \`IDX_59e3dbf9b24f9d1cb7534dbf17\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`favorite\` ADD CONSTRAINT \`FK_fd7fbcabed207b9f7398802738e\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`favorite\` ADD CONSTRAINT \`FK_7e0f07d02bea087f84f271e9bf4\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`favorite\` ADD CONSTRAINT \`FK_59e3dbf9b24f9d1cb7534dbf177\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`favorite\` DROP FOREIGN KEY \`FK_59e3dbf9b24f9d1cb7534dbf177\``);
		await queryRunner.query(`ALTER TABLE \`favorite\` DROP FOREIGN KEY \`FK_7e0f07d02bea087f84f271e9bf4\``);
		await queryRunner.query(`ALTER TABLE \`favorite\` DROP FOREIGN KEY \`FK_fd7fbcabed207b9f7398802738e\``);
		await queryRunner.query(`DROP INDEX \`IDX_59e3dbf9b24f9d1cb7534dbf17\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_b4734abeedbb9c724c980f7f54\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_a8d924902879f0a3349678c86f\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_7e0f07d02bea087f84f271e9bf\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_fd7fbcabed207b9f7398802738\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_aac7859c7c93073a7fd990ab66\` ON \`favorite\``);
		await queryRunner.query(`DROP INDEX \`IDX_8ab4c215a9b90395ce242d7cac\` ON \`favorite\``);
		await queryRunner.query(`DROP TABLE \`favorite\``);
	}
}
