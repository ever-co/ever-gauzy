import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterConstraintsForResourceLinkTable1729861943822 implements MigrationInterface {
	name = 'AlterConstraintsForResourceLinkTable1729861943822';

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
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_2ef674d18792e8864fd8d484eac"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_95603855ae10050123e48a66881"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_f9438f82f6e93bd6a87b8216af9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_841b729b80bc03ea38d16b8508"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4c25c2c9d7ebbd0c07edd824ff"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f9438f82f6e93bd6a87b8216af"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_95603855ae10050123e48a6688"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_44100d3eaf418ee67fa7a756f1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b73c278619bd8fb7f30f93182c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2ef674d18792e8864fd8d484ea"`);
		await queryRunner.query(`CREATE INDEX "IDX_e891dad6f91b8eb04a47f42a06" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_2efdd5f6dc5d0c483edbc932ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_64d90b997156b7de382fd8a88f" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3caaf70dcd98d572c0fe09c59" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ada8b0cf4463e653a756fc6db2" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_61dc38c01dfd2fe25cd934a0d1" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId") `);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_64d90b997156b7de382fd8a88f2" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f"`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_64d90b997156b7de382fd8a88f2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_df91a85b49f78544da67aa9d9a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_61dc38c01dfd2fe25cd934a0d1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ada8b0cf4463e653a756fc6db2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b3caaf70dcd98d572c0fe09c59"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_64d90b997156b7de382fd8a88f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2efdd5f6dc5d0c483edbc932ff"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e891dad6f91b8eb04a47f42a06"`);
		await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_f9438f82f6e93bd6a87b8216af9" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_95603855ae10050123e48a66881" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "resource_link" ADD CONSTRAINT "FK_2ef674d18792e8864fd8d484eac" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
		await queryRunner.query(`DROP INDEX "IDX_b73c278619bd8fb7f30f93182c"`);
		await queryRunner.query(`DROP INDEX "IDX_44100d3eaf418ee67fa7a756f1"`);
		await queryRunner.query(`DROP INDEX "IDX_95603855ae10050123e48a6688"`);
		await queryRunner.query(`DROP INDEX "IDX_f9438f82f6e93bd6a87b8216af"`);
		await queryRunner.query(`DROP INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff"`);
		await queryRunner.query(`DROP INDEX "IDX_841b729b80bc03ea38d16b8508"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "resource_link"`
		);
		await queryRunner.query(`DROP TABLE "resource_link"`);
		await queryRunner.query(`ALTER TABLE "temporary_resource_link" RENAME TO "resource_link"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar, CONSTRAINT "FK_64d90b997156b7de382fd8a88f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "resource_link"`
		);
		await queryRunner.query(`DROP TABLE "resource_link"`);
		await queryRunner.query(`ALTER TABLE "temporary_resource_link" RENAME TO "resource_link"`);
		await queryRunner.query(`CREATE INDEX "IDX_e891dad6f91b8eb04a47f42a06" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_2efdd5f6dc5d0c483edbc932ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_64d90b997156b7de382fd8a88f" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b3caaf70dcd98d572c0fe09c59" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ada8b0cf4463e653a756fc6db2" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_61dc38c01dfd2fe25cd934a0d1" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_df91a85b49f78544da67aa9d9a"`);
		await queryRunner.query(`DROP INDEX "IDX_61dc38c01dfd2fe25cd934a0d1"`);
		await queryRunner.query(`DROP INDEX "IDX_ada8b0cf4463e653a756fc6db2"`);
		await queryRunner.query(`DROP INDEX "IDX_b3caaf70dcd98d572c0fe09c59"`);
		await queryRunner.query(`DROP INDEX "IDX_64d90b997156b7de382fd8a88f"`);
		await queryRunner.query(`DROP INDEX "IDX_2efdd5f6dc5d0c483edbc932ff"`);
		await queryRunner.query(`DROP INDEX "IDX_e891dad6f91b8eb04a47f42a06"`);
		await queryRunner.query(`ALTER TABLE "resource_link" RENAME TO "temporary_resource_link"`);
		await queryRunner.query(
			`CREATE TABLE "resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "temporary_resource_link"`
		);
		await queryRunner.query(`DROP TABLE "temporary_resource_link"`);
		await queryRunner.query(`DROP INDEX "IDX_e891dad6f91b8eb04a47f42a06"`);
		await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
		await queryRunner.query(`ALTER TABLE "resource_link" RENAME TO "temporary_resource_link"`);
		await queryRunner.query(
			`CREATE TABLE "resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar, CONSTRAINT "FK_2ef674d18792e8864fd8d484eac" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_95603855ae10050123e48a66881" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f9438f82f6e93bd6a87b8216af9" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "temporary_resource_link"`
		);
		await queryRunner.query(`DROP TABLE "temporary_resource_link"`);
		await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_2ef674d18792e8864fd8d484eac\``);
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_95603855ae10050123e48a66881\``);
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_f9438f82f6e93bd6a87b8216af9\``);
		await queryRunner.query(`DROP INDEX \`IDX_4c25c2c9d7ebbd0c07edd824ff\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_f9438f82f6e93bd6a87b8216af\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_44100d3eaf418ee67fa7a756f1\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ef674d18792e8864fd8d484ea\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_841b729b80bc03ea38d16b8508\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_b73c278619bd8fb7f30f93182c\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_95603855ae10050123e48a6688\` ON \`resource_link\``);
		await queryRunner.query(`CREATE INDEX \`IDX_e891dad6f91b8eb04a47f42a06\` ON \`resource_link\` (\`isActive\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_2efdd5f6dc5d0c483edbc932ff\` ON \`resource_link\` (\`isArchived\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_64d90b997156b7de382fd8a88f\` ON \`resource_link\` (\`tenantId\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_b3caaf70dcd98d572c0fe09c59\` ON \`resource_link\` (\`organizationId\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_ada8b0cf4463e653a756fc6db2\` ON \`resource_link\` (\`entity\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_61dc38c01dfd2fe25cd934a0d1\` ON \`resource_link\` (\`entityId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_df91a85b49f78544da67aa9d9a\` ON \`resource_link\` (\`creatorId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_64d90b997156b7de382fd8a88f2\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_b3caaf70dcd98d572c0fe09c59f\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_df91a85b49f78544da67aa9d9ad\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_df91a85b49f78544da67aa9d9ad\``);
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_b3caaf70dcd98d572c0fe09c59f\``);
		await queryRunner.query(`ALTER TABLE \`resource_link\` DROP FOREIGN KEY \`FK_64d90b997156b7de382fd8a88f2\``);
		await queryRunner.query(`DROP INDEX \`IDX_df91a85b49f78544da67aa9d9a\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_61dc38c01dfd2fe25cd934a0d1\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_ada8b0cf4463e653a756fc6db2\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_b3caaf70dcd98d572c0fe09c59\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_64d90b997156b7de382fd8a88f\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_2efdd5f6dc5d0c483edbc932ff\` ON \`resource_link\``);
		await queryRunner.query(`DROP INDEX \`IDX_e891dad6f91b8eb04a47f42a06\` ON \`resource_link\``);
		await queryRunner.query(
			`CREATE INDEX \`IDX_95603855ae10050123e48a6688\` ON \`resource_link\` (\`organizationId\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_b73c278619bd8fb7f30f93182c\` ON \`resource_link\` (\`entityId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_841b729b80bc03ea38d16b8508\` ON \`resource_link\` (\`isActive\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_2ef674d18792e8864fd8d484ea\` ON \`resource_link\` (\`creatorId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_44100d3eaf418ee67fa7a756f1\` ON \`resource_link\` (\`entity\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_f9438f82f6e93bd6a87b8216af\` ON \`resource_link\` (\`tenantId\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_4c25c2c9d7ebbd0c07edd824ff\` ON \`resource_link\` (\`isArchived\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_f9438f82f6e93bd6a87b8216af9\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_95603855ae10050123e48a66881\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`resource_link\` ADD CONSTRAINT \`FK_2ef674d18792e8864fd8d484eac\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
