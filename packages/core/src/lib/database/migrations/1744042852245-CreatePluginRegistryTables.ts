import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreatePluginRegistryTables1744042852245 implements MigrationInterface {
	name = 'CreatePluginRegistryTables1744042852245';

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
		await queryRunner.query(`CREATE TYPE "public"."plugin_type_enum" AS ENUM('DESKTOP', 'WEB', 'MOBILE')`);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "description" character varying, "type" "public"."plugin_type_enum" NOT NULL DEFAULT 'DESKTOP', "status" "public"."plugin_status_enum" NOT NULL DEFAULT 'ACTIVE', "author" character varying, "license" character varying, "homepage" character varying, "repository" character varying, "uploadedById" uuid, "uploadedAt" TIMESTAMP, "lastDownloadedAt" TIMESTAMP, CONSTRAINT "PK_9a65387180b2e67287345684c03" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_7c3688c98c2cdfd05c3b7bb88d" ON "plugin" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_220e5b9a8ba6d2e516c0fa7ff4" ON "plugin" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d68bb86d4cc9696720cf02f327" ON "plugin" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_252f425ee09ff688e9217b976c" ON "plugin" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_05e841613ecefbadf0eaf0a394" ON "plugin" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_5c6a707a544a1a99fe812ad197" ON "plugin" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cdd4d6e608dbac3d35cadc0b28" ON "plugin" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_923ef271a64240756c418e417e" ON "plugin" ("uploadedById") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "plugin_name_unique" ON "plugin" ("name", "tenantId", "organizationId") `
		);
		await queryRunner.query(`CREATE TYPE "public"."plugin_source_type_enum" AS ENUM('CDN', 'NPM', 'GAUZY')`);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_source_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_source" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "type" "public"."plugin_source_type_enum" NOT NULL DEFAULT 'GAUZY', "url" character varying, "integrity" character varying, "crossOrigin" character varying, "name" character varying, "registry" character varying, "authToken" character varying, "scope" character varying, "filePath" character varying, "fileName" character varying, "fileSize" integer, "mimeType" character varying, "fileKey" character varying, "storageProvider" "public"."plugin_source_storageprovider_enum", CONSTRAINT "PK_71e0a0e707d4b9f820c17f86aae" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_version" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "number" character varying NOT NULL, "changelog" character varying NOT NULL, "checksum" character varying, "signature" character varying, "releaseDate" TIMESTAMP, "downloadCount" integer DEFAULT '0', "pluginId" uuid, "sourceId" uuid, CONSTRAINT "PK_eeb07a209be95b5be49cba59506" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_installation_status_enum" AS ENUM('INSTALLED', 'UNINSTALLED', 'FAILED', 'IN_PROGRESS')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_installation" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "pluginId" uuid, "versionId" uuid, "installedById" uuid, "installedAt" TIMESTAMP, "uninstalledAt" TIMESTAMP, "status" "public"."plugin_installation_status_enum" NOT NULL DEFAULT 'IN_PROGRESS', CONSTRAINT "PK_02e4e7b02c67f804402cb4024fc" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0e5f736f4bae285465ce05d81f" ON "plugin_installation" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb5347a4524869ce01ad22b410" ON "plugin_installation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4af328bc85385d0d7a4db44" ON "plugin_installation" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b2736edd3271ae93ac74562d8d" ON "plugin_installation" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a364835e06cb9808ca4b93b4a" ON "plugin_installation" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_731d86983d8b3dc7cebc0ceb8f" ON "plugin_installation" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_42b298829d83d366ae2376f2cb" ON "plugin_installation" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_03620f08161e043b2ba2b54962" ON "plugin_installation" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5acaca47cfe43f77a762f8f52" ON "plugin_installation" ("versionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f9ac2acfa7ac5ce3fbfe5b8eaf" ON "plugin_installation" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3003252e5d74975894d7ed4177" ON "plugin_installation" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c8e4d312492e0a580a242389a6" ON "plugin_installation" ("uninstalledAt") `
		);
		await queryRunner.query(
			`ALTER TABLE "plugin" ADD CONSTRAINT "FK_7c3688c98c2cdfd05c3b7bb88de" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin" ADD CONSTRAINT "FK_220e5b9a8ba6d2e516c0fa7ff4a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin" ADD CONSTRAINT "FK_d68bb86d4cc9696720cf02f3277" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin" ADD CONSTRAINT "FK_5c6a707a544a1a99fe812ad197a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin" ADD CONSTRAINT "FK_cdd4d6e608dbac3d35cadc0b28a" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin" ADD CONSTRAINT "FK_923ef271a64240756c418e417eb" FOREIGN KEY ("uploadedById") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_source" ADD CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_26055fbc6d60ce8ef96c77e16c7" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_3971ab167afbeaaba96d6cb9a05" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_1549236e0d968bd869822d1732f" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_216cf6b8c20a2e0a9380c17c6b7" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_ffadd2f2026dac3093d91146b64" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_b2675c6a056281d5155b1b7bb86" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_version" ADD CONSTRAINT "FK_e459ef09a96deb0763e27822634" FOREIGN KEY ("sourceId") REFERENCES "plugin_source"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_0e5f736f4bae285465ce05d81f8" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_eb5347a4524869ce01ad22b4103" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_c7c4af328bc85385d0d7a4db444" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_731d86983d8b3dc7cebc0ceb8f4" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_42b298829d83d366ae2376f2cbf" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_03620f08161e043b2ba2b549629" FOREIGN KEY ("pluginId") REFERENCES "plugin"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_d5acaca47cfe43f77a762f8f528" FOREIGN KEY ("versionId") REFERENCES "plugin_version"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installation" ADD CONSTRAINT "FK_f9ac2acfa7ac5ce3fbfe5b8eaf5" FOREIGN KEY ("installedById") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_f9ac2acfa7ac5ce3fbfe5b8eaf5"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_d5acaca47cfe43f77a762f8f528"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_03620f08161e043b2ba2b549629"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_42b298829d83d366ae2376f2cbf"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_731d86983d8b3dc7cebc0ceb8f4"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_c7c4af328bc85385d0d7a4db444"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_eb5347a4524869ce01ad22b4103"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" DROP CONSTRAINT "FK_0e5f736f4bae285465ce05d81f8"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_e459ef09a96deb0763e27822634"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_b2675c6a056281d5155b1b7bb86"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_ffadd2f2026dac3093d91146b64"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_216cf6b8c20a2e0a9380c17c6b7"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_1549236e0d968bd869822d1732f"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_3971ab167afbeaaba96d6cb9a05"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" DROP CONSTRAINT "FK_26055fbc6d60ce8ef96c77e16c7"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP CONSTRAINT "FK_834606ec25b3e69303f59d65893"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" DROP CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861"`);
		await queryRunner.query(`ALTER TABLE "plugin" DROP CONSTRAINT "FK_923ef271a64240756c418e417eb"`);
		await queryRunner.query(`ALTER TABLE "plugin" DROP CONSTRAINT "FK_cdd4d6e608dbac3d35cadc0b28a"`);
		await queryRunner.query(`ALTER TABLE "plugin" DROP CONSTRAINT "FK_5c6a707a544a1a99fe812ad197a"`);
		await queryRunner.query(`ALTER TABLE "plugin" DROP CONSTRAINT "FK_d68bb86d4cc9696720cf02f3277"`);
		await queryRunner.query(`ALTER TABLE "plugin" DROP CONSTRAINT "FK_220e5b9a8ba6d2e516c0fa7ff4a"`);
		await queryRunner.query(`ALTER TABLE "plugin" DROP CONSTRAINT "FK_7c3688c98c2cdfd05c3b7bb88de"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c8e4d312492e0a580a242389a6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3003252e5d74975894d7ed4177"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f9ac2acfa7ac5ce3fbfe5b8eaf"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d5acaca47cfe43f77a762f8f52"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_03620f08161e043b2ba2b54962"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_42b298829d83d366ae2376f2cb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_731d86983d8b3dc7cebc0ceb8f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8a364835e06cb9808ca4b93b4a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b2736edd3271ae93ac74562d8d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c7c4af328bc85385d0d7a4db44"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eb5347a4524869ce01ad22b410"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0e5f736f4bae285465ce05d81f"`);
		await queryRunner.query(`DROP TABLE "plugin_installation"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_installation_status_enum"`);
		await queryRunner.query(`DROP INDEX "public"."version_number_unique"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(`DROP TABLE "plugin_version"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`DROP TABLE "plugin_source"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_source_storageprovider_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_source_type_enum"`);
		await queryRunner.query(`DROP INDEX "public"."plugin_name_unique"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_923ef271a64240756c418e417e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cdd4d6e608dbac3d35cadc0b28"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5c6a707a544a1a99fe812ad197"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_05e841613ecefbadf0eaf0a394"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_252f425ee09ff688e9217b976c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d68bb86d4cc9696720cf02f327"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_220e5b9a8ba6d2e516c0fa7ff4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7c3688c98c2cdfd05c3b7bb88d"`);
		await queryRunner.query(`DROP TABLE "plugin"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_status_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_type_enum"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "plugin" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "type" varchar CHECK( "type" IN ('DESKTOP','WEB','MOBILE') ) NOT NULL DEFAULT ('DESKTOP'), "status" varchar CHECK( "status" IN ('ACTIVE','INACTIVE','DEPRECATED','ARCHIVED') ) NOT NULL DEFAULT ('ACTIVE'), "author" varchar, "license" varchar, "homepage" varchar, "repository" varchar, "uploadedById" varchar, "uploadedAt" datetime, "lastDownloadedAt" datetime)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_7c3688c98c2cdfd05c3b7bb88d" ON "plugin" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_220e5b9a8ba6d2e516c0fa7ff4" ON "plugin" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d68bb86d4cc9696720cf02f327" ON "plugin" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_252f425ee09ff688e9217b976c" ON "plugin" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_05e841613ecefbadf0eaf0a394" ON "plugin" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_5c6a707a544a1a99fe812ad197" ON "plugin" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cdd4d6e608dbac3d35cadc0b28" ON "plugin" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_923ef271a64240756c418e417e" ON "plugin" ("uploadedById") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "plugin_name_unique" ON "plugin" ("name", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "authToken" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, "sourceId" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_installation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar, "versionId" varchar, "installedById" varchar, "installedAt" datetime, "uninstalledAt" datetime, "status" varchar CHECK( "status" IN ('INSTALLED','UNINSTALLED','FAILED','IN_PROGRESS') ) NOT NULL DEFAULT ('IN_PROGRESS'))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0e5f736f4bae285465ce05d81f" ON "plugin_installation" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb5347a4524869ce01ad22b410" ON "plugin_installation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4af328bc85385d0d7a4db44" ON "plugin_installation" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b2736edd3271ae93ac74562d8d" ON "plugin_installation" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a364835e06cb9808ca4b93b4a" ON "plugin_installation" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_731d86983d8b3dc7cebc0ceb8f" ON "plugin_installation" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_42b298829d83d366ae2376f2cb" ON "plugin_installation" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_03620f08161e043b2ba2b54962" ON "plugin_installation" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5acaca47cfe43f77a762f8f52" ON "plugin_installation" ("versionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f9ac2acfa7ac5ce3fbfe5b8eaf" ON "plugin_installation" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3003252e5d74975894d7ed4177" ON "plugin_installation" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c8e4d312492e0a580a242389a6" ON "plugin_installation" ("uninstalledAt") `
		);
		await queryRunner.query(`DROP INDEX "IDX_7c3688c98c2cdfd05c3b7bb88d"`);
		await queryRunner.query(`DROP INDEX "IDX_220e5b9a8ba6d2e516c0fa7ff4"`);
		await queryRunner.query(`DROP INDEX "IDX_d68bb86d4cc9696720cf02f327"`);
		await queryRunner.query(`DROP INDEX "IDX_252f425ee09ff688e9217b976c"`);
		await queryRunner.query(`DROP INDEX "IDX_05e841613ecefbadf0eaf0a394"`);
		await queryRunner.query(`DROP INDEX "IDX_5c6a707a544a1a99fe812ad197"`);
		await queryRunner.query(`DROP INDEX "IDX_cdd4d6e608dbac3d35cadc0b28"`);
		await queryRunner.query(`DROP INDEX "IDX_923ef271a64240756c418e417e"`);
		await queryRunner.query(`DROP INDEX "plugin_name_unique"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "type" varchar CHECK( "type" IN ('DESKTOP','WEB','MOBILE') ) NOT NULL DEFAULT ('DESKTOP'), "status" varchar CHECK( "status" IN ('ACTIVE','INACTIVE','DEPRECATED','ARCHIVED') ) NOT NULL DEFAULT ('ACTIVE'), "author" varchar, "license" varchar, "homepage" varchar, "repository" varchar, "uploadedById" varchar, "uploadedAt" datetime, "lastDownloadedAt" datetime, CONSTRAINT "FK_7c3688c98c2cdfd05c3b7bb88de" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_220e5b9a8ba6d2e516c0fa7ff4a" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d68bb86d4cc9696720cf02f3277" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5c6a707a544a1a99fe812ad197a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cdd4d6e608dbac3d35cadc0b28a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_923ef271a64240756c418e417eb" FOREIGN KEY ("uploadedById") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "type", "status", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "lastDownloadedAt") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "type", "status", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "lastDownloadedAt" FROM "plugin"`
		);
		await queryRunner.query(`DROP TABLE "plugin"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin" RENAME TO "plugin"`);
		await queryRunner.query(`CREATE INDEX "IDX_7c3688c98c2cdfd05c3b7bb88d" ON "plugin" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_220e5b9a8ba6d2e516c0fa7ff4" ON "plugin" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d68bb86d4cc9696720cf02f327" ON "plugin" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_252f425ee09ff688e9217b976c" ON "plugin" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_05e841613ecefbadf0eaf0a394" ON "plugin" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_5c6a707a544a1a99fe812ad197" ON "plugin" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cdd4d6e608dbac3d35cadc0b28" ON "plugin" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_923ef271a64240756c418e417e" ON "plugin" ("uploadedById") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "plugin_name_unique" ON "plugin" ("name", "tenantId", "organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "authToken" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), CONSTRAINT "FK_27fdaefcb8465eb3cb6c20e1861" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a69a8ef5d1c35133a727915eae8" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_834606ec25b3e69303f59d65893" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9acdcb59ff7adecbac0a6ebeb5c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b93bd5d3d1c0b78e2e87a351305" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "authToken", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "authToken", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider" FROM "plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "plugin_source"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_source" RENAME TO "plugin_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`DROP INDEX "IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(`DROP INDEX "IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`DROP INDEX "version_number_unique"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, "sourceId" varchar, CONSTRAINT "FK_26055fbc6d60ce8ef96c77e16c7" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3971ab167afbeaaba96d6cb9a05" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1549236e0d968bd869822d1732f" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_216cf6b8c20a2e0a9380c17c6b7" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ffadd2f2026dac3093d91146b64" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b2675c6a056281d5155b1b7bb86" FOREIGN KEY ("pluginId") REFERENCES "plugin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e459ef09a96deb0763e27822634" FOREIGN KEY ("sourceId") REFERENCES "plugin_source" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId" FROM "plugin_version"`
		);
		await queryRunner.query(`DROP TABLE "plugin_version"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_version" RENAME TO "plugin_version"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_0e5f736f4bae285465ce05d81f"`);
		await queryRunner.query(`DROP INDEX "IDX_eb5347a4524869ce01ad22b410"`);
		await queryRunner.query(`DROP INDEX "IDX_c7c4af328bc85385d0d7a4db44"`);
		await queryRunner.query(`DROP INDEX "IDX_b2736edd3271ae93ac74562d8d"`);
		await queryRunner.query(`DROP INDEX "IDX_8a364835e06cb9808ca4b93b4a"`);
		await queryRunner.query(`DROP INDEX "IDX_731d86983d8b3dc7cebc0ceb8f"`);
		await queryRunner.query(`DROP INDEX "IDX_42b298829d83d366ae2376f2cb"`);
		await queryRunner.query(`DROP INDEX "IDX_03620f08161e043b2ba2b54962"`);
		await queryRunner.query(`DROP INDEX "IDX_d5acaca47cfe43f77a762f8f52"`);
		await queryRunner.query(`DROP INDEX "IDX_f9ac2acfa7ac5ce3fbfe5b8eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_3003252e5d74975894d7ed4177"`);
		await queryRunner.query(`DROP INDEX "IDX_c8e4d312492e0a580a242389a6"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_installation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar, "versionId" varchar, "installedById" varchar, "installedAt" datetime, "uninstalledAt" datetime, "status" varchar CHECK( "status" IN ('INSTALLED','UNINSTALLED','FAILED','IN_PROGRESS') ) NOT NULL DEFAULT ('IN_PROGRESS'), CONSTRAINT "FK_0e5f736f4bae285465ce05d81f8" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eb5347a4524869ce01ad22b4103" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c7c4af328bc85385d0d7a4db444" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_731d86983d8b3dc7cebc0ceb8f4" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_42b298829d83d366ae2376f2cbf" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_03620f08161e043b2ba2b549629" FOREIGN KEY ("pluginId") REFERENCES "plugin" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d5acaca47cfe43f77a762f8f528" FOREIGN KEY ("versionId") REFERENCES "plugin_version" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f9ac2acfa7ac5ce3fbfe5b8eaf5" FOREIGN KEY ("installedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_installation"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status" FROM "plugin_installation"`
		);
		await queryRunner.query(`DROP TABLE "plugin_installation"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_installation" RENAME TO "plugin_installation"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_0e5f736f4bae285465ce05d81f" ON "plugin_installation" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb5347a4524869ce01ad22b410" ON "plugin_installation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4af328bc85385d0d7a4db44" ON "plugin_installation" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b2736edd3271ae93ac74562d8d" ON "plugin_installation" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a364835e06cb9808ca4b93b4a" ON "plugin_installation" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_731d86983d8b3dc7cebc0ceb8f" ON "plugin_installation" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_42b298829d83d366ae2376f2cb" ON "plugin_installation" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_03620f08161e043b2ba2b54962" ON "plugin_installation" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5acaca47cfe43f77a762f8f52" ON "plugin_installation" ("versionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f9ac2acfa7ac5ce3fbfe5b8eaf" ON "plugin_installation" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3003252e5d74975894d7ed4177" ON "plugin_installation" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c8e4d312492e0a580a242389a6" ON "plugin_installation" ("uninstalledAt") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_c8e4d312492e0a580a242389a6"`);
		await queryRunner.query(`DROP INDEX "IDX_3003252e5d74975894d7ed4177"`);
		await queryRunner.query(`DROP INDEX "IDX_f9ac2acfa7ac5ce3fbfe5b8eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_d5acaca47cfe43f77a762f8f52"`);
		await queryRunner.query(`DROP INDEX "IDX_03620f08161e043b2ba2b54962"`);
		await queryRunner.query(`DROP INDEX "IDX_42b298829d83d366ae2376f2cb"`);
		await queryRunner.query(`DROP INDEX "IDX_731d86983d8b3dc7cebc0ceb8f"`);
		await queryRunner.query(`DROP INDEX "IDX_8a364835e06cb9808ca4b93b4a"`);
		await queryRunner.query(`DROP INDEX "IDX_b2736edd3271ae93ac74562d8d"`);
		await queryRunner.query(`DROP INDEX "IDX_c7c4af328bc85385d0d7a4db44"`);
		await queryRunner.query(`DROP INDEX "IDX_eb5347a4524869ce01ad22b410"`);
		await queryRunner.query(`DROP INDEX "IDX_0e5f736f4bae285465ce05d81f"`);
		await queryRunner.query(`ALTER TABLE "plugin_installation" RENAME TO "temporary_plugin_installation"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_installation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar, "versionId" varchar, "installedById" varchar, "installedAt" datetime, "uninstalledAt" datetime, "status" varchar CHECK( "status" IN ('INSTALLED','UNINSTALLED','FAILED','IN_PROGRESS') ) NOT NULL DEFAULT ('IN_PROGRESS'))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_installation"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status" FROM "temporary_plugin_installation"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_installation"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_c8e4d312492e0a580a242389a6" ON "plugin_installation" ("uninstalledAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3003252e5d74975894d7ed4177" ON "plugin_installation" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f9ac2acfa7ac5ce3fbfe5b8eaf" ON "plugin_installation" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d5acaca47cfe43f77a762f8f52" ON "plugin_installation" ("versionId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_03620f08161e043b2ba2b54962" ON "plugin_installation" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_42b298829d83d366ae2376f2cb" ON "plugin_installation" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_731d86983d8b3dc7cebc0ceb8f" ON "plugin_installation" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8a364835e06cb9808ca4b93b4a" ON "plugin_installation" ("isArchived") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b2736edd3271ae93ac74562d8d" ON "plugin_installation" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4af328bc85385d0d7a4db44" ON "plugin_installation" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb5347a4524869ce01ad22b410" ON "plugin_installation" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0e5f736f4bae285465ce05d81f" ON "plugin_installation" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "version_number_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`DROP INDEX "IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(`ALTER TABLE "plugin_version" RENAME TO "temporary_plugin_version"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_version" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, "sourceId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_version"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId", "sourceId" FROM "temporary_plugin_version"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_version"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "version_number_unique" ON "plugin_version" ("number", "pluginId", "organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e459ef09a96deb0763e2782263" ON "plugin_version" ("sourceId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2675c6a056281d5155b1b7bb8" ON "plugin_version" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_66225a5548f3a7fee54b8f6805" ON "plugin_version" ("releaseDate") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ffadd2f2026dac3093d91146b6" ON "plugin_version" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_216cf6b8c20a2e0a9380c17c6b" ON "plugin_version" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5966e93c557c13baa72ea2812d" ON "plugin_version" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_b113606a9ed1b208e91a090e57" ON "plugin_version" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1549236e0d968bd869822d1732" ON "plugin_version" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3971ab167afbeaaba96d6cb9a0" ON "plugin_version" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_26055fbc6d60ce8ef96c77e16c" ON "plugin_version" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`ALTER TABLE "plugin_source" RENAME TO "temporary_plugin_source"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_source" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "authToken" varchar, "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_source"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "authToken", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "url", "integrity", "crossOrigin", "name", "registry", "authToken", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "storageProvider" FROM "temporary_plugin_source"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_source"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ff61527634c5d822340f3e79ff" ON "plugin_source" ("storageProvider") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b93bd5d3d1c0b78e2e87a35130" ON "plugin_source" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5" ON "plugin_source" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b78c1749e36da714a7d2fe73df" ON "plugin_source" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_753472d9f81abe508cffe15ad8" ON "plugin_source" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_834606ec25b3e69303f59d6589" ON "plugin_source" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a69a8ef5d1c35133a727915eae" ON "plugin_source" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27fdaefcb8465eb3cb6c20e186" ON "plugin_source" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "plugin_name_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_923ef271a64240756c418e417e"`);
		await queryRunner.query(`DROP INDEX "IDX_cdd4d6e608dbac3d35cadc0b28"`);
		await queryRunner.query(`DROP INDEX "IDX_5c6a707a544a1a99fe812ad197"`);
		await queryRunner.query(`DROP INDEX "IDX_05e841613ecefbadf0eaf0a394"`);
		await queryRunner.query(`DROP INDEX "IDX_252f425ee09ff688e9217b976c"`);
		await queryRunner.query(`DROP INDEX "IDX_d68bb86d4cc9696720cf02f327"`);
		await queryRunner.query(`DROP INDEX "IDX_220e5b9a8ba6d2e516c0fa7ff4"`);
		await queryRunner.query(`DROP INDEX "IDX_7c3688c98c2cdfd05c3b7bb88d"`);
		await queryRunner.query(`ALTER TABLE "plugin" RENAME TO "temporary_plugin"`);
		await queryRunner.query(
			`CREATE TABLE "plugin" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "type" varchar CHECK( "type" IN ('DESKTOP','WEB','MOBILE') ) NOT NULL DEFAULT ('DESKTOP'), "status" varchar CHECK( "status" IN ('ACTIVE','INACTIVE','DEPRECATED','ARCHIVED') ) NOT NULL DEFAULT ('ACTIVE'), "author" varchar, "license" varchar, "homepage" varchar, "repository" varchar, "uploadedById" varchar, "uploadedAt" datetime, "lastDownloadedAt" datetime)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "type", "status", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "lastDownloadedAt") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "type", "status", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "lastDownloadedAt" FROM "temporary_plugin"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "plugin_name_unique" ON "plugin" ("name", "tenantId", "organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_923ef271a64240756c418e417e" ON "plugin" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_cdd4d6e608dbac3d35cadc0b28" ON "plugin" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_5c6a707a544a1a99fe812ad197" ON "plugin" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_05e841613ecefbadf0eaf0a394" ON "plugin" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_252f425ee09ff688e9217b976c" ON "plugin" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_d68bb86d4cc9696720cf02f327" ON "plugin" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_220e5b9a8ba6d2e516c0fa7ff4" ON "plugin" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c3688c98c2cdfd05c3b7bb88d" ON "plugin" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_c8e4d312492e0a580a242389a6"`);
		await queryRunner.query(`DROP INDEX "IDX_3003252e5d74975894d7ed4177"`);
		await queryRunner.query(`DROP INDEX "IDX_f9ac2acfa7ac5ce3fbfe5b8eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_d5acaca47cfe43f77a762f8f52"`);
		await queryRunner.query(`DROP INDEX "IDX_03620f08161e043b2ba2b54962"`);
		await queryRunner.query(`DROP INDEX "IDX_42b298829d83d366ae2376f2cb"`);
		await queryRunner.query(`DROP INDEX "IDX_731d86983d8b3dc7cebc0ceb8f"`);
		await queryRunner.query(`DROP INDEX "IDX_8a364835e06cb9808ca4b93b4a"`);
		await queryRunner.query(`DROP INDEX "IDX_b2736edd3271ae93ac74562d8d"`);
		await queryRunner.query(`DROP INDEX "IDX_c7c4af328bc85385d0d7a4db44"`);
		await queryRunner.query(`DROP INDEX "IDX_eb5347a4524869ce01ad22b410"`);
		await queryRunner.query(`DROP INDEX "IDX_0e5f736f4bae285465ce05d81f"`);
		await queryRunner.query(`DROP TABLE "plugin_installation"`);
		await queryRunner.query(`DROP INDEX "version_number_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_e459ef09a96deb0763e2782263"`);
		await queryRunner.query(`DROP INDEX "IDX_b2675c6a056281d5155b1b7bb8"`);
		await queryRunner.query(`DROP INDEX "IDX_66225a5548f3a7fee54b8f6805"`);
		await queryRunner.query(`DROP INDEX "IDX_ffadd2f2026dac3093d91146b6"`);
		await queryRunner.query(`DROP INDEX "IDX_216cf6b8c20a2e0a9380c17c6b"`);
		await queryRunner.query(`DROP INDEX "IDX_5966e93c557c13baa72ea2812d"`);
		await queryRunner.query(`DROP INDEX "IDX_b113606a9ed1b208e91a090e57"`);
		await queryRunner.query(`DROP INDEX "IDX_1549236e0d968bd869822d1732"`);
		await queryRunner.query(`DROP INDEX "IDX_3971ab167afbeaaba96d6cb9a0"`);
		await queryRunner.query(`DROP INDEX "IDX_26055fbc6d60ce8ef96c77e16c"`);
		await queryRunner.query(`DROP TABLE "plugin_version"`);
		await queryRunner.query(`DROP INDEX "IDX_ff61527634c5d822340f3e79ff"`);
		await queryRunner.query(`DROP INDEX "IDX_b93bd5d3d1c0b78e2e87a35130"`);
		await queryRunner.query(`DROP INDEX "IDX_9acdcb59ff7adecbac0a6ebeb5"`);
		await queryRunner.query(`DROP INDEX "IDX_b78c1749e36da714a7d2fe73df"`);
		await queryRunner.query(`DROP INDEX "IDX_753472d9f81abe508cffe15ad8"`);
		await queryRunner.query(`DROP INDEX "IDX_834606ec25b3e69303f59d6589"`);
		await queryRunner.query(`DROP INDEX "IDX_a69a8ef5d1c35133a727915eae"`);
		await queryRunner.query(`DROP INDEX "IDX_27fdaefcb8465eb3cb6c20e186"`);
		await queryRunner.query(`DROP TABLE "plugin_source"`);
		await queryRunner.query(`DROP INDEX "plugin_name_unique"`);
		await queryRunner.query(`DROP INDEX "IDX_923ef271a64240756c418e417e"`);
		await queryRunner.query(`DROP INDEX "IDX_cdd4d6e608dbac3d35cadc0b28"`);
		await queryRunner.query(`DROP INDEX "IDX_5c6a707a544a1a99fe812ad197"`);
		await queryRunner.query(`DROP INDEX "IDX_05e841613ecefbadf0eaf0a394"`);
		await queryRunner.query(`DROP INDEX "IDX_252f425ee09ff688e9217b976c"`);
		await queryRunner.query(`DROP INDEX "IDX_d68bb86d4cc9696720cf02f327"`);
		await queryRunner.query(`DROP INDEX "IDX_220e5b9a8ba6d2e516c0fa7ff4"`);
		await queryRunner.query(`DROP INDEX "IDX_7c3688c98c2cdfd05c3b7bb88d"`);
		await queryRunner.query(`DROP TABLE "plugin"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`plugin\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`type\` enum ('DESKTOP', 'WEB', 'MOBILE') NOT NULL DEFAULT 'DESKTOP', \`status\` enum ('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE', \`author\` varchar(255) NULL, \`license\` varchar(255) NULL, \`homepage\` varchar(255) NULL, \`repository\` varchar(255) NULL, \`uploadedById\` varchar(255) NULL, \`uploadedAt\` datetime NULL, \`lastDownloadedAt\` datetime NULL, INDEX \`IDX_7c3688c98c2cdfd05c3b7bb88d\` (\`createdByUserId\`), INDEX \`IDX_220e5b9a8ba6d2e516c0fa7ff4\` (\`updatedByUserId\`), INDEX \`IDX_d68bb86d4cc9696720cf02f327\` (\`deletedByUserId\`), INDEX \`IDX_252f425ee09ff688e9217b976c\` (\`isActive\`), INDEX \`IDX_05e841613ecefbadf0eaf0a394\` (\`isArchived\`), INDEX \`IDX_5c6a707a544a1a99fe812ad197\` (\`tenantId\`), INDEX \`IDX_cdd4d6e608dbac3d35cadc0b28\` (\`organizationId\`), INDEX \`IDX_923ef271a64240756c418e417e\` (\`uploadedById\`), UNIQUE INDEX \`plugin_name_unique\` (\`name\`, \`tenantId\`, \`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_source\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`type\` enum ('CDN', 'NPM', 'GAUZY') NOT NULL DEFAULT 'GAUZY', \`url\` varchar(255) NULL, \`integrity\` varchar(255) NULL, \`crossOrigin\` varchar(255) NULL, \`name\` varchar(255) NULL, \`registry\` varchar(255) NULL, \`authToken\` varchar(255) NULL, \`scope\` varchar(255) NULL, \`filePath\` varchar(255) NULL, \`fileName\` varchar(255) NULL, \`fileSize\` int NULL, \`mimeType\` varchar(255) NULL, \`fileKey\` varchar(255) NULL, \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN') NULL, INDEX \`IDX_27fdaefcb8465eb3cb6c20e186\` (\`createdByUserId\`), INDEX \`IDX_a69a8ef5d1c35133a727915eae\` (\`updatedByUserId\`), INDEX \`IDX_834606ec25b3e69303f59d6589\` (\`deletedByUserId\`), INDEX \`IDX_753472d9f81abe508cffe15ad8\` (\`isActive\`), INDEX \`IDX_b78c1749e36da714a7d2fe73df\` (\`isArchived\`), INDEX \`IDX_9acdcb59ff7adecbac0a6ebeb5\` (\`tenantId\`), INDEX \`IDX_b93bd5d3d1c0b78e2e87a35130\` (\`organizationId\`), INDEX \`IDX_ff61527634c5d822340f3e79ff\` (\`storageProvider\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_version\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`number\` varchar(255) NOT NULL, \`changelog\` varchar(255) NOT NULL, \`checksum\` varchar(255) NULL, \`signature\` varchar(255) NULL, \`releaseDate\` datetime NULL, \`downloadCount\` int NULL DEFAULT '0', \`pluginId\` varchar(255) NULL, \`sourceId\` varchar(255) NULL, INDEX \`IDX_26055fbc6d60ce8ef96c77e16c\` (\`createdByUserId\`), INDEX \`IDX_3971ab167afbeaaba96d6cb9a0\` (\`updatedByUserId\`), INDEX \`IDX_1549236e0d968bd869822d1732\` (\`deletedByUserId\`), INDEX \`IDX_b113606a9ed1b208e91a090e57\` (\`isActive\`), INDEX \`IDX_5966e93c557c13baa72ea2812d\` (\`isArchived\`), INDEX \`IDX_216cf6b8c20a2e0a9380c17c6b\` (\`tenantId\`), INDEX \`IDX_ffadd2f2026dac3093d91146b6\` (\`organizationId\`), INDEX \`IDX_66225a5548f3a7fee54b8f6805\` (\`releaseDate\`), INDEX \`IDX_b2675c6a056281d5155b1b7bb8\` (\`pluginId\`), INDEX \`IDX_e459ef09a96deb0763e2782263\` (\`sourceId\`), UNIQUE INDEX \`version_number_unique\` (\`number\`, \`pluginId\`, \`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_installation\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`pluginId\` varchar(255) NULL, \`versionId\` varchar(255) NULL, \`installedById\` varchar(255) NULL, \`installedAt\` datetime NULL, \`uninstalledAt\` datetime NULL, \`status\` enum ('INSTALLED', 'UNINSTALLED', 'FAILED', 'IN_PROGRESS') NOT NULL DEFAULT 'IN_PROGRESS', INDEX \`IDX_0e5f736f4bae285465ce05d81f\` (\`createdByUserId\`), INDEX \`IDX_eb5347a4524869ce01ad22b410\` (\`updatedByUserId\`), INDEX \`IDX_c7c4af328bc85385d0d7a4db44\` (\`deletedByUserId\`), INDEX \`IDX_b2736edd3271ae93ac74562d8d\` (\`isActive\`), INDEX \`IDX_8a364835e06cb9808ca4b93b4a\` (\`isArchived\`), INDEX \`IDX_731d86983d8b3dc7cebc0ceb8f\` (\`tenantId\`), INDEX \`IDX_42b298829d83d366ae2376f2cb\` (\`organizationId\`), INDEX \`IDX_03620f08161e043b2ba2b54962\` (\`pluginId\`), INDEX \`IDX_d5acaca47cfe43f77a762f8f52\` (\`versionId\`), INDEX \`IDX_f9ac2acfa7ac5ce3fbfe5b8eaf\` (\`installedById\`), INDEX \`IDX_3003252e5d74975894d7ed4177\` (\`installedAt\`), INDEX \`IDX_c8e4d312492e0a580a242389a6\` (\`uninstalledAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin\` ADD CONSTRAINT \`FK_7c3688c98c2cdfd05c3b7bb88de\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin\` ADD CONSTRAINT \`FK_220e5b9a8ba6d2e516c0fa7ff4a\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin\` ADD CONSTRAINT \`FK_d68bb86d4cc9696720cf02f3277\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin\` ADD CONSTRAINT \`FK_5c6a707a544a1a99fe812ad197a\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin\` ADD CONSTRAINT \`FK_cdd4d6e608dbac3d35cadc0b28a\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin\` ADD CONSTRAINT \`FK_923ef271a64240756c418e417eb\` FOREIGN KEY (\`uploadedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD CONSTRAINT \`FK_27fdaefcb8465eb3cb6c20e1861\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD CONSTRAINT \`FK_a69a8ef5d1c35133a727915eae8\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD CONSTRAINT \`FK_834606ec25b3e69303f59d65893\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD CONSTRAINT \`FK_9acdcb59ff7adecbac0a6ebeb5c\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_source\` ADD CONSTRAINT \`FK_b93bd5d3d1c0b78e2e87a351305\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_26055fbc6d60ce8ef96c77e16c7\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_3971ab167afbeaaba96d6cb9a05\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_1549236e0d968bd869822d1732f\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_216cf6b8c20a2e0a9380c17c6b7\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_ffadd2f2026dac3093d91146b64\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_b2675c6a056281d5155b1b7bb86\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugin\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_version\` ADD CONSTRAINT \`FK_e459ef09a96deb0763e27822634\` FOREIGN KEY (\`sourceId\`) REFERENCES \`plugin_source\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_0e5f736f4bae285465ce05d81f8\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_eb5347a4524869ce01ad22b4103\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_c7c4af328bc85385d0d7a4db444\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_731d86983d8b3dc7cebc0ceb8f4\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_42b298829d83d366ae2376f2cbf\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_03620f08161e043b2ba2b549629\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugin\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_d5acaca47cfe43f77a762f8f528\` FOREIGN KEY (\`versionId\`) REFERENCES \`plugin_version\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` ADD CONSTRAINT \`FK_f9ac2acfa7ac5ce3fbfe5b8eaf5\` FOREIGN KEY (\`installedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_f9ac2acfa7ac5ce3fbfe5b8eaf5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_d5acaca47cfe43f77a762f8f528\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_03620f08161e043b2ba2b549629\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_42b298829d83d366ae2376f2cbf\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_731d86983d8b3dc7cebc0ceb8f4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_c7c4af328bc85385d0d7a4db444\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_eb5347a4524869ce01ad22b4103\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installation\` DROP FOREIGN KEY \`FK_0e5f736f4bae285465ce05d81f8\``
		);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_e459ef09a96deb0763e27822634\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_b2675c6a056281d5155b1b7bb86\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_ffadd2f2026dac3093d91146b64\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_216cf6b8c20a2e0a9380c17c6b7\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_1549236e0d968bd869822d1732f\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_3971ab167afbeaaba96d6cb9a05\``);
		await queryRunner.query(`ALTER TABLE \`plugin_version\` DROP FOREIGN KEY \`FK_26055fbc6d60ce8ef96c77e16c7\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP FOREIGN KEY \`FK_b93bd5d3d1c0b78e2e87a351305\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP FOREIGN KEY \`FK_9acdcb59ff7adecbac0a6ebeb5c\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP FOREIGN KEY \`FK_834606ec25b3e69303f59d65893\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP FOREIGN KEY \`FK_a69a8ef5d1c35133a727915eae8\``);
		await queryRunner.query(`ALTER TABLE \`plugin_source\` DROP FOREIGN KEY \`FK_27fdaefcb8465eb3cb6c20e1861\``);
		await queryRunner.query(`ALTER TABLE \`plugin\` DROP FOREIGN KEY \`FK_923ef271a64240756c418e417eb\``);
		await queryRunner.query(`ALTER TABLE \`plugin\` DROP FOREIGN KEY \`FK_cdd4d6e608dbac3d35cadc0b28a\``);
		await queryRunner.query(`ALTER TABLE \`plugin\` DROP FOREIGN KEY \`FK_5c6a707a544a1a99fe812ad197a\``);
		await queryRunner.query(`ALTER TABLE \`plugin\` DROP FOREIGN KEY \`FK_d68bb86d4cc9696720cf02f3277\``);
		await queryRunner.query(`ALTER TABLE \`plugin\` DROP FOREIGN KEY \`FK_220e5b9a8ba6d2e516c0fa7ff4a\``);
		await queryRunner.query(`ALTER TABLE \`plugin\` DROP FOREIGN KEY \`FK_7c3688c98c2cdfd05c3b7bb88de\``);
		await queryRunner.query(`DROP INDEX \`IDX_c8e4d312492e0a580a242389a6\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_3003252e5d74975894d7ed4177\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_f9ac2acfa7ac5ce3fbfe5b8eaf\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_d5acaca47cfe43f77a762f8f52\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_03620f08161e043b2ba2b54962\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_42b298829d83d366ae2376f2cb\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_731d86983d8b3dc7cebc0ceb8f\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_8a364835e06cb9808ca4b93b4a\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_b2736edd3271ae93ac74562d8d\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_c7c4af328bc85385d0d7a4db44\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_eb5347a4524869ce01ad22b410\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`IDX_0e5f736f4bae285465ce05d81f\` ON \`plugin_installation\``);
		await queryRunner.query(`DROP TABLE \`plugin_installation\``);
		await queryRunner.query(`DROP INDEX \`version_number_unique\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_e459ef09a96deb0763e2782263\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_b2675c6a056281d5155b1b7bb8\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_66225a5548f3a7fee54b8f6805\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_ffadd2f2026dac3093d91146b6\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_216cf6b8c20a2e0a9380c17c6b\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_5966e93c557c13baa72ea2812d\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_b113606a9ed1b208e91a090e57\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_1549236e0d968bd869822d1732\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_3971ab167afbeaaba96d6cb9a0\` ON \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_26055fbc6d60ce8ef96c77e16c\` ON \`plugin_version\``);
		await queryRunner.query(`DROP TABLE \`plugin_version\``);
		await queryRunner.query(`DROP INDEX \`IDX_ff61527634c5d822340f3e79ff\` ON \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_b93bd5d3d1c0b78e2e87a35130\` ON \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_9acdcb59ff7adecbac0a6ebeb5\` ON \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_b78c1749e36da714a7d2fe73df\` ON \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_753472d9f81abe508cffe15ad8\` ON \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_834606ec25b3e69303f59d6589\` ON \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_a69a8ef5d1c35133a727915eae\` ON \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`IDX_27fdaefcb8465eb3cb6c20e186\` ON \`plugin_source\``);
		await queryRunner.query(`DROP TABLE \`plugin_source\``);
		await queryRunner.query(`DROP INDEX \`plugin_name_unique\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_923ef271a64240756c418e417e\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_cdd4d6e608dbac3d35cadc0b28\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_5c6a707a544a1a99fe812ad197\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_05e841613ecefbadf0eaf0a394\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_252f425ee09ff688e9217b976c\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_d68bb86d4cc9696720cf02f327\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_220e5b9a8ba6d2e516c0fa7ff4\` ON \`plugin\``);
		await queryRunner.query(`DROP INDEX \`IDX_7c3688c98c2cdfd05c3b7bb88d\` ON \`plugin\``);
		await queryRunner.query(`DROP TABLE \`plugin\``);
	}
}
