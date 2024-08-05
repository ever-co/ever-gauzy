import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterUserTableAddDefaultTeamAndWorkspace1722522985782 implements MigrationInterface {
	name = 'AlterUserTableAddDefaultTeamAndWorkspace1722522985782';

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
		await queryRunner.query(`ALTER TABLE "user" ADD "defaultTeamId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_1a8ae1126aae1823d62ccf3f82" ON "user" ("defaultTeamId") `);
		await queryRunner.query(
			`ALTER TABLE "user" ADD CONSTRAINT "FK_1a8ae1126aae1823d62ccf3f821" FOREIGN KEY ("defaultTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(`ALTER TABLE "user" ADD "defaultOrganizationId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_0e9f745ad08103a1c21523326c" ON "user" ("defaultOrganizationId") `);
		await queryRunner.query(
			`ALTER TABLE "user" ADD CONSTRAINT "FK_0e9f745ad08103a1c21523326c6" FOREIGN KEY ("defaultOrganizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_1a8ae1126aae1823d62ccf3f821"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1a8ae1126aae1823d62ccf3f82"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "defaultTeamId"`);
		await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_0e9f745ad08103a1c21523326c6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0e9f745ad08103a1c21523326c"`);
		await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "defaultOrganizationId"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_557cb712d32a9ad9ffbb4cd50d"`);
		await queryRunner.query(`DROP INDEX "IDX_fde2ce12ab12b02ae583dd76c7"`);
		await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
		await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
		await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
		await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
		await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
		await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
		await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
		await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
		await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" varchar, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "timeFormat" varchar CHECK( "timeFormat" IN ('12','24') ) NOT NULL DEFAULT (12), "defaultTeamId" varchar, "defaultOrganizationId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat" FROM "user"`
		);
		await queryRunner.query(`DROP TABLE "user"`);
		await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
		await queryRunner.query(`CREATE INDEX "IDX_557cb712d32a9ad9ffbb4cd50d" ON "user" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_fde2ce12ab12b02ae583dd76c7" ON "user" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
		await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
		await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
		await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
		await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
		await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a8ae1126aae1823d62ccf3f82" ON "user" ("defaultTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0e9f745ad08103a1c21523326c" ON "user" ("defaultOrganizationId") `);
		await queryRunner.query(`DROP INDEX "IDX_557cb712d32a9ad9ffbb4cd50d"`);
		await queryRunner.query(`DROP INDEX "IDX_fde2ce12ab12b02ae583dd76c7"`);
		await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
		await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
		await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
		await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
		await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
		await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
		await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
		await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
		await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
		await queryRunner.query(`DROP INDEX "IDX_1a8ae1126aae1823d62ccf3f82"`);
		await queryRunner.query(`DROP INDEX "IDX_0e9f745ad08103a1c21523326c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" varchar, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "timeFormat" varchar CHECK( "timeFormat" IN ('12','24') ) NOT NULL DEFAULT (12), "defaultTeamId" varchar, "defaultOrganizationId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1a8ae1126aae1823d62ccf3f821" FOREIGN KEY ("defaultTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_0e9f745ad08103a1c21523326c6" FOREIGN KEY ("defaultOrganizationId") REFERENCES "organization" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat", "defaultTeamId", "defaultOrganizationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat", "defaultTeamId", "defaultOrganizationId" FROM "user"`
		);
		await queryRunner.query(`DROP TABLE "user"`);
		await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
		await queryRunner.query(`CREATE INDEX "IDX_557cb712d32a9ad9ffbb4cd50d" ON "user" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_fde2ce12ab12b02ae583dd76c7" ON "user" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
		await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
		await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
		await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
		await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
		await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a8ae1126aae1823d62ccf3f82" ON "user" ("defaultTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0e9f745ad08103a1c21523326c" ON "user" ("defaultOrganizationId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_0e9f745ad08103a1c21523326c"`);
		await queryRunner.query(`DROP INDEX "IDX_1a8ae1126aae1823d62ccf3f82"`);
		await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
		await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
		await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
		await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
		await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
		await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
		await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
		await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
		await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
		await queryRunner.query(`DROP INDEX "IDX_fde2ce12ab12b02ae583dd76c7"`);
		await queryRunner.query(`DROP INDEX "IDX_557cb712d32a9ad9ffbb4cd50d"`);
		await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
		await queryRunner.query(
			`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" varchar, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "timeFormat" varchar CHECK( "timeFormat" IN ('12','24') ) NOT NULL DEFAULT (12), "defaultTeamId" varchar, "defaultOrganizationId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat", "defaultTeamId", "defaultOrganizationId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat", "defaultTeamId", "defaultOrganizationId" FROM "temporary_user"`
		);
		await queryRunner.query(`DROP TABLE "temporary_user"`);
		await queryRunner.query(`CREATE INDEX "IDX_0e9f745ad08103a1c21523326c" ON "user" ("defaultOrganizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1a8ae1126aae1823d62ccf3f82" ON "user" ("defaultTeamId") `);
		await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
		await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
		await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
		await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
		await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
		await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fde2ce12ab12b02ae583dd76c7" ON "user" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_557cb712d32a9ad9ffbb4cd50d" ON "user" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_0e9f745ad08103a1c21523326c"`);
		await queryRunner.query(`DROP INDEX "IDX_1a8ae1126aae1823d62ccf3f82"`);
		await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
		await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
		await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
		await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
		await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
		await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
		await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
		await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
		await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
		await queryRunner.query(`DROP INDEX "IDX_fde2ce12ab12b02ae583dd76c7"`);
		await queryRunner.query(`DROP INDEX "IDX_557cb712d32a9ad9ffbb4cd50d"`);
		await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
		await queryRunner.query(
			`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" varchar, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "timeFormat" varchar CHECK( "timeFormat" IN ('12','24') ) NOT NULL DEFAULT (12), CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId", "isArchived", "deletedAt", "timeFormat" FROM "temporary_user"`
		);
		await queryRunner.query(`DROP TABLE "temporary_user"`);
		await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
		await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
		await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
		await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
		await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
		await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
		await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fde2ce12ab12b02ae583dd76c7" ON "user" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_557cb712d32a9ad9ffbb4cd50d" ON "user" ("isArchived") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`user\` ADD \`defaultTeamId\` char(36)`);
		await queryRunner.query(`CREATE INDEX \`IDX_1a8ae1126aae1823d62ccf3f82\` ON \`user\` (\`defaultTeamId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_1a8ae1126aae1823d62ccf3f821\` FOREIGN KEY (\`defaultTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(`ALTER TABLE \`user\` ADD \`defaultOrganizationId\` CHAR(36)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_0e9f745ad08103a1c21523326c\` ON \`user\` (\`defaultOrganizationId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`user\` ADD CONSTRAINT \`FK_0e9f745ad08103a1c21523326c6\` FOREIGN KEY (\`defaultOrganizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_1a8ae1126aae1823d62ccf3f821\``);
		await queryRunner.query(`DROP INDEX \`IDX_1a8ae1126aae1823d62ccf3f82\` ON \`user\``);
		await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`defaultTeamId\``);
		await queryRunner.query(`ALTER TABLE \`user\` DROP FOREIGN KEY \`FK_0e9f745ad08103a1c21523326c6\``);
		await queryRunner.query(`DROP INDEX \`IDX_0e9f745ad08103a1c21523326c\` ON \`user\``);
		await queryRunner.query(`ALTER TABLE \`user\` DROP COLUMN \`defaultOrganizationId\``);
	}
}
