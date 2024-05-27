import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateSocialAccountEntity1716839592949 implements MigrationInterface {
	name = 'CreateSocialAccountEntity1716839592949';

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
			`CREATE TABLE "social_account" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "provider" character varying NOT NULL, "providerAccountId" character varying NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_a69e41dd6fa725d17b040eda5e6" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_a2eb41b1d6ee72de9486558199" ON "social_account" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_1d8e3566b66fbad38b6e2290a2" ON "social_account" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3b32d609a4c884a776ab883be" ON "social_account" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e8b7694e86fe9534778832f90c" ON "social_account" ("userId") `);
		await queryRunner.query(
			`ALTER TABLE "social_account" ADD CONSTRAINT "FK_a3b32d609a4c884a776ab883be3" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "social_account" ADD CONSTRAINT "FK_e8b7694e86fe9534778832f90c0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "social_account" DROP CONSTRAINT "FK_e8b7694e86fe9534778832f90c0"`);
		await queryRunner.query(`ALTER TABLE "social_account" DROP CONSTRAINT "FK_a3b32d609a4c884a776ab883be3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e8b7694e86fe9534778832f90c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a3b32d609a4c884a776ab883be"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1d8e3566b66fbad38b6e2290a2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a2eb41b1d6ee72de9486558199"`);
		await queryRunner.query(`DROP TABLE "social_account"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`social_account\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`provider\` varchar(255) NOT NULL, \`providerAccountId\` varchar(255) NOT NULL, \`userId\` varchar(255) NOT NULL, INDEX \`IDX_a2eb41b1d6ee72de9486558199\` (\`isActive\`), INDEX \`IDX_1d8e3566b66fbad38b6e2290a2\` (\`isArchived\`), INDEX \`IDX_a3b32d609a4c884a776ab883be\` (\`tenantId\`), INDEX \`IDX_e8b7694e86fe9534778832f90c\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(`ALTER TABLE \`organization_team\` ADD \`shareProfileView\` tinyint NULL DEFAULT 1`);
		await queryRunner.query(`ALTER TABLE \`issue_type\` ADD \`isDefault\` tinyint NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`user\` ADD \`timeFormat\` enum ('12', '24') NOT NULL DEFAULT '12'`);
		await queryRunner.query(
			`ALTER TABLE \`social_account\` ADD CONSTRAINT \`FK_a3b32d609a4c884a776ab883be3\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`social_account\` ADD CONSTRAINT \`FK_e8b7694e86fe9534778832f90c0\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`social_account\` DROP FOREIGN KEY \`FK_e8b7694e86fe9534778832f90c0\``);
		await queryRunner.query(`ALTER TABLE \`social_account\` DROP FOREIGN KEY \`FK_a3b32d609a4c884a776ab883be3\``);
		await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`timeFormat\``);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP COLUMN \`isDefault\``);
		await queryRunner.query(`ALTER TABLE \`organization_team\` DROP COLUMN \`shareProfileView\``);
		await queryRunner.query(`DROP INDEX \`IDX_e8b7694e86fe9534778832f90c\` ON \`social_account\``);
		await queryRunner.query(`DROP INDEX \`IDX_a3b32d609a4c884a776ab883be\` ON \`social_account\``);
		await queryRunner.query(`DROP INDEX \`IDX_1d8e3566b66fbad38b6e2290a2\` ON \`social_account\``);
		await queryRunner.query(`DROP INDEX \`IDX_a2eb41b1d6ee72de9486558199\` ON \`social_account\``);
		await queryRunner.query(`DROP TABLE \`social_account\``);
	}
}
