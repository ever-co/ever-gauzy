import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateAiChatConversationTable1783272719587 implements MigrationInterface {
	name = 'CreateAiChatConversationTable1783272719587';

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
			`CREATE TABLE "ai_chat_conversation" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "userId" character varying NOT NULL, "title" character varying NOT NULL, "messages" text NOT NULL, CONSTRAINT "PK_bd32361512fc47c6e1b86691f28" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_92d267aecde262cc5405651cbf" ON "ai_chat_conversation" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2334c91fa21922b73ab5a56c35" ON "ai_chat_conversation" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cbbf346d07f83de71482c0f39c" ON "ai_chat_conversation" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d4b467400b229a53e67148fa4" ON "ai_chat_conversation" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_61c7072cad78e7ae4b1ec2b556" ON "ai_chat_conversation" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_50a06f8e70623fd1ea8df0e921" ON "ai_chat_conversation" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d683aef79816b0d49e6949d45c" ON "ai_chat_conversation" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8650c1afcc4138a6f553f1e403" ON "ai_chat_conversation" ("userId") `);
		await queryRunner.query(
			`ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "FK_92d267aecde262cc5405651cbf4" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "FK_2334c91fa21922b73ab5a56c359" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "FK_cbbf346d07f83de71482c0f39c1" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "FK_50a06f8e70623fd1ea8df0e9212" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "ai_chat_conversation" ADD CONSTRAINT "FK_d683aef79816b0d49e6949d45c9" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "ai_chat_conversation" DROP CONSTRAINT "FK_d683aef79816b0d49e6949d45c9"`);
		await queryRunner.query(`ALTER TABLE "ai_chat_conversation" DROP CONSTRAINT "FK_50a06f8e70623fd1ea8df0e9212"`);
		await queryRunner.query(`ALTER TABLE "ai_chat_conversation" DROP CONSTRAINT "FK_cbbf346d07f83de71482c0f39c1"`);
		await queryRunner.query(`ALTER TABLE "ai_chat_conversation" DROP CONSTRAINT "FK_2334c91fa21922b73ab5a56c359"`);
		await queryRunner.query(`ALTER TABLE "ai_chat_conversation" DROP CONSTRAINT "FK_92d267aecde262cc5405651cbf4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8650c1afcc4138a6f553f1e403"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d683aef79816b0d49e6949d45c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_50a06f8e70623fd1ea8df0e921"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_61c7072cad78e7ae4b1ec2b556"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3d4b467400b229a53e67148fa4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cbbf346d07f83de71482c0f39c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2334c91fa21922b73ab5a56c35"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_92d267aecde262cc5405651cbf"`);
		await queryRunner.query(`DROP TABLE "ai_chat_conversation"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "ai_chat_conversation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "userId" varchar NOT NULL, "title" varchar NOT NULL, "messages" text NOT NULL, CONSTRAINT "FK_92d267aecde262cc5405651cbf4" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2334c91fa21922b73ab5a56c359" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cbbf346d07f83de71482c0f39c1" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_50a06f8e70623fd1ea8df0e9212" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d683aef79816b0d49e6949d45c9" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_92d267aecde262cc5405651cbf" ON "ai_chat_conversation" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_2334c91fa21922b73ab5a56c35" ON "ai_chat_conversation" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cbbf346d07f83de71482c0f39c" ON "ai_chat_conversation" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d4b467400b229a53e67148fa4" ON "ai_chat_conversation" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_61c7072cad78e7ae4b1ec2b556" ON "ai_chat_conversation" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_50a06f8e70623fd1ea8df0e921" ON "ai_chat_conversation" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d683aef79816b0d49e6949d45c" ON "ai_chat_conversation" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8650c1afcc4138a6f553f1e403" ON "ai_chat_conversation" ("userId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_8650c1afcc4138a6f553f1e403"`);
		await queryRunner.query(`DROP INDEX "IDX_d683aef79816b0d49e6949d45c"`);
		await queryRunner.query(`DROP INDEX "IDX_50a06f8e70623fd1ea8df0e921"`);
		await queryRunner.query(`DROP INDEX "IDX_61c7072cad78e7ae4b1ec2b556"`);
		await queryRunner.query(`DROP INDEX "IDX_3d4b467400b229a53e67148fa4"`);
		await queryRunner.query(`DROP INDEX "IDX_cbbf346d07f83de71482c0f39c"`);
		await queryRunner.query(`DROP INDEX "IDX_2334c91fa21922b73ab5a56c35"`);
		await queryRunner.query(`DROP INDEX "IDX_92d267aecde262cc5405651cbf"`);
		await queryRunner.query(`DROP TABLE "ai_chat_conversation"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`ai_chat_conversation\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`userId\` varchar(255) NOT NULL, \`title\` varchar(255) NOT NULL, \`messages\` mediumtext NOT NULL, INDEX \`IDX_92d267aecde262cc5405651cbf\` (\`createdByUserId\`), INDEX \`IDX_2334c91fa21922b73ab5a56c35\` (\`updatedByUserId\`), INDEX \`IDX_cbbf346d07f83de71482c0f39c\` (\`deletedByUserId\`), INDEX \`IDX_3d4b467400b229a53e67148fa4\` (\`isActive\`), INDEX \`IDX_61c7072cad78e7ae4b1ec2b556\` (\`isArchived\`), INDEX \`IDX_50a06f8e70623fd1ea8df0e921\` (\`tenantId\`), INDEX \`IDX_d683aef79816b0d49e6949d45c\` (\`organizationId\`), INDEX \`IDX_8650c1afcc4138a6f553f1e403\` (\`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_chat_conversation\` ADD CONSTRAINT \`FK_92d267aecde262cc5405651cbf4\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_chat_conversation\` ADD CONSTRAINT \`FK_2334c91fa21922b73ab5a56c359\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_chat_conversation\` ADD CONSTRAINT \`FK_cbbf346d07f83de71482c0f39c1\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_chat_conversation\` ADD CONSTRAINT \`FK_50a06f8e70623fd1ea8df0e9212\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`ai_chat_conversation\` ADD CONSTRAINT \`FK_d683aef79816b0d49e6949d45c9\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`ai_chat_conversation\` DROP FOREIGN KEY \`FK_d683aef79816b0d49e6949d45c9\``);
		await queryRunner.query(`ALTER TABLE \`ai_chat_conversation\` DROP FOREIGN KEY \`FK_50a06f8e70623fd1ea8df0e9212\``);
		await queryRunner.query(`ALTER TABLE \`ai_chat_conversation\` DROP FOREIGN KEY \`FK_cbbf346d07f83de71482c0f39c1\``);
		await queryRunner.query(`ALTER TABLE \`ai_chat_conversation\` DROP FOREIGN KEY \`FK_2334c91fa21922b73ab5a56c359\``);
		await queryRunner.query(`ALTER TABLE \`ai_chat_conversation\` DROP FOREIGN KEY \`FK_92d267aecde262cc5405651cbf4\``);
		await queryRunner.query(`DROP INDEX \`IDX_8650c1afcc4138a6f553f1e403\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP INDEX \`IDX_d683aef79816b0d49e6949d45c\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP INDEX \`IDX_50a06f8e70623fd1ea8df0e921\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP INDEX \`IDX_61c7072cad78e7ae4b1ec2b556\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP INDEX \`IDX_3d4b467400b229a53e67148fa4\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP INDEX \`IDX_cbbf346d07f83de71482c0f39c\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP INDEX \`IDX_2334c91fa21922b73ab5a56c35\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP INDEX \`IDX_92d267aecde262cc5405651cbf\` ON \`ai_chat_conversation\``);
		await queryRunner.query(`DROP TABLE \`ai_chat_conversation\``);
	}
}
