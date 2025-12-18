import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePluginMarketplaceTables1766045577607 implements MigrationInterface {
	name = 'CreatePluginMarketplaceTables1766045577607';

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
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_tenants_scope_enum" AS ENUM('tenant', 'organization', 'user')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenants" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "pluginId" uuid NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "scope" "public"."plugin_tenants_scope_enum" NOT NULL DEFAULT 'user', "autoInstall" boolean NOT NULL DEFAULT false, "requiresApproval" boolean NOT NULL DEFAULT true, "isMandatory" boolean NOT NULL DEFAULT false, "maxInstallations" integer, "maxActiveUsers" integer, "currentInstallations" integer NOT NULL DEFAULT '0', "currentActiveUsers" integer NOT NULL DEFAULT '0', "tenantConfiguration" jsonb, "preferences" jsonb, "approvedAt" TIMESTAMP, "isDataCompliant" boolean NOT NULL DEFAULT true, "complianceCertifications" text, "approvedById" uuid, CONSTRAINT "PK_994378ab16d5ce4bb7793a3ffab" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f209a8620f1677ed2c82c4cd2e" ON "plugin_tenants" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b5cc71673410a449491fb3db9" ON "plugin_tenants" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_06f10073cd6e84a19b6f604ddd" ON "plugin_tenants" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cf185e176c869e2be48d00d648" ON "plugin_tenants" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ed7c977facb534e572d33b485" ON "plugin_tenants" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_5df2b63d82f2168e43c2d7e64c" ON "plugin_tenants" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_545faee53386f4e9d7b4311104" ON "plugin_tenants" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c47db2e2072ba3b57060819246" ON "plugin_tenants" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d6a338f4eb5b467c2ff5eaa4b" ON "plugin_tenants" ("enabled") `);
		await queryRunner.query(`CREATE INDEX "IDX_e723cb5fdc4092538fe0384853" ON "plugin_tenants" ("scope") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4accce384c6007c92b9afdc2d" ON "plugin_tenants" ("currentInstallations") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1aca41d7ee08b3b140eae4ee88" ON "plugin_tenants" ("currentActiveUsers") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a32259b1b9cdeea1c6d94bf94c" ON "plugin_tenants" ("approvedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_52ca2ab9f943fe3f47df36aef7" ON "plugin_tenants" ("approvedById") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4f1dada611375594ce22411cbe" ON "plugin_tenants" ("pluginId", "enabled") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_69f72957e1c98832cdab0c486e" ON "plugin_tenants" ("organizationId", "scope") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a3a616a07b21a4212736493f5e" ON "plugin_tenants" ("tenantId", "scope", "enabled") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1394aebfcfe6782051e76f46a5" ON "plugin_tenants" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_settings_datatype_enum" AS ENUM('string', 'number', 'boolean', 'json', 'file')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_settings" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "key" character varying NOT NULL, "value" text NOT NULL, "isRequired" boolean NOT NULL DEFAULT false, "isEncrypted" boolean NOT NULL DEFAULT false, "description" text, "order" integer, "validationRules" text, "dataType" "public"."plugin_settings_datatype_enum" NOT NULL DEFAULT 'string', "defaultValue" character varying, "pluginId" uuid NOT NULL, "pluginTenantId" uuid, "categoryId" uuid, "updatedById" uuid, CONSTRAINT "PK_ae7adb397738141e37cdd4e4539" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5534e36ff3a1416c17f507d546" ON "plugin_settings" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b8deef29d0fb5eee571c39b39" ON "plugin_settings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a97ab238dc6aff5f305d37dbc7" ON "plugin_settings" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cf20745f234b0b3512c03d74be" ON "plugin_settings" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_199b3708ea7962d21fc55de243" ON "plugin_settings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_bbced9536ca0a8ee967b531c32" ON "plugin_settings" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d4504369b0f19d2360a464408a" ON "plugin_settings" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_737e0935140d7b17632fc7815a" ON "plugin_settings" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8e11188fb92db2ee126b53e866" ON "plugin_settings" ("pluginTenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a8471a91f63494a0d3ec5cf248" ON "plugin_settings" ("categoryId") `);
		await queryRunner.query(`CREATE INDEX "IDX_734649a34ee071f44de4a14490" ON "plugin_settings" ("updatedById") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_48aa394150a960cf3e7b285cf4" ON "plugin_settings" ("pluginId", "key", "pluginTenantId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_categories" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "description" text, "slug" character varying NOT NULL, "color" character varying, "icon" character varying, "order" integer NOT NULL DEFAULT '0', "metadata" jsonb, "parentId" uuid, CONSTRAINT "UQ_d427c34c4dd721c72d5d56187f9" UNIQUE ("slug"), CONSTRAINT "PK_02cd60be2345ddb1e88bab84483" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_60543808734ff13850d7843f7b" ON "plugin_categories" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4b6b97be418be173859d10d" ON "plugin_categories" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1fa4520b20a0bf4fdfe3ca1ec7" ON "plugin_categories" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_99ab190a6b7ae5ffc61b4dfaf4" ON "plugin_categories" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b23665ef0d73dbe47d4d26f3d5" ON "plugin_categories" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c239f665e5caedd708c62b1f7" ON "plugin_categories" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca31918911db08a4008be72c8e" ON "plugin_categories" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tags" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "pluginId" uuid NOT NULL, "tagId" uuid NOT NULL, "appliedAt" TIMESTAMP DEFAULT now(), "appliedById" uuid, "priority" integer DEFAULT '50', "isFeatured" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_fd8a7a93fd298fb02fc68ee5e14" PRIMARY KEY ("id")); COMMENT ON COLUMN "plugin_tags"."priority" IS 'Priority weight for tag association (0-100, higher = more important)'; COMMENT ON COLUMN "plugin_tags"."isFeatured" IS 'Indicates if this tag association should be featured/highlighted'`
		);
		await queryRunner.query(`CREATE INDEX "IDX_9b013a85a6ae26db17101ffb89" ON "plugin_tags" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee480ffb800fb2c9f6d91f66aa" ON "plugin_tags" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_09654ebaec00e0c0c4dfae4c42" ON "plugin_tags" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fe4db46e2c3d32f64b4a4728e3" ON "plugin_tags" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_cacbb5fd767b06985be6049858" ON "plugin_tags" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_da359f059e06030ec33adba133" ON "plugin_tags" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8bcd0243b780191a391b348f58" ON "plugin_tags" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_05292c8750270ff028ab2fec14" ON "plugin_tags" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_df3d0fc648c9e0544ca11df9d2" ON "plugin_tags" ("tagId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_17c923b300710a13f6dfade59b" ON "plugin_tags" ("tagId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cddb5e04a93a957dc4d56522b7" ON "plugin_tags" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_676e7c749905331c36b1707ba8" ON "plugin_tags" ("pluginId", "tagId") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_installations_status_enum" AS ENUM('INSTALLED', 'UNINSTALLED', 'FAILED', 'IN_PROGRESS')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_installations" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "pluginId" uuid, "versionId" uuid, "installedById" uuid, "installedAt" TIMESTAMP, "uninstalledAt" TIMESTAMP, "status" "public"."plugin_installations_status_enum" NOT NULL DEFAULT 'IN_PROGRESS', "isActivated" boolean NOT NULL DEFAULT false, "activatedAt" TIMESTAMP, "deactivatedAt" TIMESTAMP, CONSTRAINT "PK_af29f092b24666b0ceacead453c" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_842e5e5f94c4008a42d4b5f44a" ON "plugin_installations" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7e9b8b3eebb881753e07b73f6c" ON "plugin_installations" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a45f5c2aba22d4fa4eb8fa85af" ON "plugin_installations" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d742ed346264f4c9d9225265d7" ON "plugin_installations" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3e63eed07bcc0e3e36d9183cca" ON "plugin_installations" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dff9e6c763c8c33b07f330e6a1" ON "plugin_installations" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aafffefdce2eb11079ec2aa75" ON "plugin_installations" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_547e4b71ae81ee772fa4ab79e6" ON "plugin_installations" ("pluginId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_acac58b213936ea488d0a8d1a3" ON "plugin_installations" ("versionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_32c3f7a738ec8b40d6375b2933" ON "plugin_installations" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_28624735b4e3ace75883521a57" ON "plugin_installations" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c92ea21dfcfd889730e2214c8f" ON "plugin_installations" ("uninstalledAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e6b80341a4ed75ae7c4af6897" ON "plugin_installations" ("activatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3c3ce338e7716d853220d8b176" ON "plugin_installations" ("deactivatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_173e0668b17afd3696abf3c518" ON "plugin_installations" ("installedById", "pluginId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1569d8ca526d958d82483e15c7" ON "plugin_installations" ("pluginId", "tenantId", "organizationId", "installedById") `
		);
		await queryRunner.query(`CREATE TYPE "public"."plugin_sources_type_enum" AS ENUM('CDN', 'NPM', 'GAUZY')`);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_sources_operatingsystem_enum" AS ENUM('LINUX', 'MAC', 'WINDOWS', 'UNIVERSAL')`
		);
		await queryRunner.query(`CREATE TYPE "public"."plugin_sources_architecture_enum" AS ENUM('X64', 'ARM')`);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_sources_storageprovider_enum" AS ENUM('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_sources" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "type" "public"."plugin_sources_type_enum" NOT NULL DEFAULT 'GAUZY', "operatingSystem" "public"."plugin_sources_operatingsystem_enum" NOT NULL DEFAULT 'UNIVERSAL', "architecture" "public"."plugin_sources_architecture_enum" NOT NULL DEFAULT 'X64', "url" character varying, "integrity" character varying, "crossOrigin" character varying, "name" character varying, "registry" character varying, "private" boolean DEFAULT false, "scope" character varying, "filePath" character varying, "fileName" character varying, "fileSize" integer, "mimeType" character varying, "fileKey" character varying, "versionId" uuid, "storageProvider" "public"."plugin_sources_storageprovider_enum", CONSTRAINT "PK_f3b8f3deb563db7010fb5a7b6c0" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_09a383d6f2858d49c064ca4cda" ON "plugin_sources" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0404416b5c1cd48ae87fe81834" ON "plugin_sources" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c90b796bd033e54e3719213a0c" ON "plugin_sources" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cb9a1e5640b8e07a9a63b51245" ON "plugin_sources" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ab83b39cc676ee2097714fb3b" ON "plugin_sources" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_19d9135639e3b40ec0dca1c926" ON "plugin_sources" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7c6dc1cdd58690b7179d76184b" ON "plugin_sources" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_55bee446d2c470e5d6b066a27a" ON "plugin_sources" ("versionId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d658bc853b354445cf2a0d6fb7" ON "plugin_sources" ("storageProvider") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af8978fbf37560525c19ec7048" ON "plugin_sources" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6fae6d0ddfd7177abcb4befd72" ON "plugin_sources" ("versionId", "operatingSystem", "architecture", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_versions" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "number" character varying NOT NULL, "changelog" character varying NOT NULL, "checksum" character varying, "signature" character varying, "releaseDate" TIMESTAMP, "downloadCount" integer DEFAULT '0', "pluginId" uuid, CONSTRAINT "PK_d45355357c416a54832493a865a" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_485db4d1cc977cc3d499824d95" ON "plugin_versions" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b36b5701e9890a395ded76cb5" ON "plugin_versions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e06094816e67e584dea754cc81" ON "plugin_versions" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e6d49799b916946e5cd5399385" ON "plugin_versions" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_a16869769b9a219acb157bb2b3" ON "plugin_versions" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_650ccf2e7394509f7ad8448e32" ON "plugin_versions" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f806bae81cd490404a1888ad5b" ON "plugin_versions" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ab6e29cd444226f80bf0c0c1db" ON "plugin_versions" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_8adf7a9181e968bcafc71236c8" ON "plugin_versions" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fa0eda3add1fb070ba172a44e" ON "plugin_versions" ("downloadCount") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e632aa70ea7b7e5c5fdbfba41b" ON "plugin_versions" ("number") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e1e7cf1589d06ac02a12e41db0" ON "plugin_versions" ("pluginId", "releaseDate") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f5c8259c0d815486f31878864d" ON "plugin_versions" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_39d060301c8a36b51da6e4aec3" ON "plugin_versions" ("pluginId", "organizationId", "number") `
		);
		await queryRunner.query(`CREATE TYPE "public"."plugins_type_enum" AS ENUM('DESKTOP', 'WEB', 'MOBILE')`);
		await queryRunner.query(
			`CREATE TYPE "public"."plugins_status_enum" AS ENUM('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugins" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "name" character varying NOT NULL, "description" character varying, "type" "public"."plugins_type_enum" NOT NULL DEFAULT 'DESKTOP', "status" "public"."plugins_status_enum" NOT NULL DEFAULT 'ACTIVE', "categoryId" uuid, "author" character varying, "license" character varying, "homepage" character varying, "repository" character varying, "uploadedById" uuid, "uploadedAt" TIMESTAMP, "requiresSubscription" boolean NOT NULL DEFAULT false, "isFeatured" boolean NOT NULL DEFAULT false, "isVerified" boolean NOT NULL DEFAULT false, "lastDownloadedAt" TIMESTAMP, CONSTRAINT "PK_bb3d17826b76295957a253ba73e" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_cc5b64091fbfdcdbd23d6da80e" ON "plugins" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_61357761fc6b140180b104dc8d" ON "plugins" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3210c015451d02d015a23eedad" ON "plugins" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d0a1444aa92229d7f1af237184" ON "plugins" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c61c7032e7b3afd352d82bc4b4" ON "plugins" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_35ee1cb5098e17e30ee5cbc705" ON "plugins" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_100eef6409ee96d0673ee510e6" ON "plugins" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_16d0aed6fcc311379f5c75bbd2" ON "plugins" ("categoryId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4bf89f98c41969e23e3f9974d5" ON "plugins" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_15ca158f27ab3296915b7d1b38" ON "plugins" ("isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_123f1b37f4826f6241446a8416" ON "plugins" ("isVerified") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0fab3c6709a93bca88eb100a9" ON "plugins" ("status", "isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_6c8d4a0f437cfae296ef43ce13" ON "plugins" ("status", "type") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0479844f05c1132f8929cab1c8" ON "plugins" ("name") `);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_subscription_plans_type_enum" AS ENUM('free', 'trial', 'basic', 'premium', 'enterprise', 'custom')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_subscription_plans_billingperiod_enum" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one-time')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscription_plans" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "name" character varying NOT NULL, "description" text, "type" "public"."plugin_subscription_plans_type_enum" NOT NULL DEFAULT 'free', "price" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying(3) NOT NULL DEFAULT 'USD', "billingPeriod" "public"."plugin_subscription_plans_billingperiod_enum" NOT NULL DEFAULT 'monthly', "features" text NOT NULL, "limitations" jsonb, "isPopular" boolean NOT NULL DEFAULT false, "isRecommended" boolean NOT NULL DEFAULT false, "trialDays" integer, "setupFee" numeric(10,2), "discountPercentage" numeric(5,2), "metadata" jsonb, "sortOrder" integer NOT NULL DEFAULT '0', "pluginId" uuid NOT NULL, "createdById" uuid, CONSTRAINT "PK_50d5a1a9d691b355206aa1991d9" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_646aa1161ac9861061842e05c2" ON "plugin_subscription_plans" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b874f9ee9c04061b4892926388" ON "plugin_subscription_plans" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f401b811d14d8b06db0fbea30" ON "plugin_subscription_plans" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7bf8b446ca66e5824fb6ff91a" ON "plugin_subscription_plans" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dec9037a57726ae5f54bc3c4a8" ON "plugin_subscription_plans" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_234c8f3d694ae31b095bdf5a8a" ON "plugin_subscription_plans" ("price", "billingPeriod") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_37c9e1c698331b9345280374fd" ON "plugin_subscription_plans" ("isActive", "type") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_082f6cba880ecd144b28284376" ON "plugin_subscription_plans" ("pluginId", "type") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_subscriptions_status_enum" AS ENUM('active', 'cancelled', 'expired', 'trial', 'past_due', 'suspended', 'pending')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_subscriptions_scope_enum" AS ENUM('tenant', 'organization', 'user')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscriptions" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "status" "public"."plugin_subscriptions_status_enum" NOT NULL DEFAULT 'pending', "scope" "public"."plugin_subscriptions_scope_enum" NOT NULL DEFAULT 'tenant', "startDate" TIMESTAMP NOT NULL DEFAULT now(), "endDate" TIMESTAMP, "trialEndDate" TIMESTAMP, "autoRenew" boolean NOT NULL DEFAULT true, "cancelledAt" TIMESTAMP, "cancellationReason" text, "metadata" jsonb, "externalSubscriptionId" character varying, "pluginId" uuid NOT NULL, "pluginTenantId" uuid NOT NULL, "planId" uuid, "subscriberId" uuid, "parentId" uuid, CONSTRAINT "PK_6afb264e9a7966e886acd27a2ad" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_449b2294593f5787f40a60c8f2" ON "plugin_subscriptions" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ddf7be116060ee20bc16128632" ON "plugin_subscriptions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0be98c36cdbaa56f3880bc6baa" ON "plugin_subscriptions" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18743cb5933b78e2b8081589e4" ON "plugin_subscriptions" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b5163f874ce5bc6b63c8e8631a" ON "plugin_subscriptions" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7f792e3c1891f728f9e5256142" ON "plugin_subscriptions" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9bbac226cce476576134c5726e" ON "plugin_subscriptions" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7afeffe18364cae48efd454e4d" ON "plugin_subscriptions" ("scope", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_39a16aca760fc7a3cef39d5563" ON "plugin_subscriptions" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bbd6dc08c0c91724e5d26202fa" ON "plugin_subscriptions" ("externalSubscriptionId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_4e8a9f4ee7df8c39d0314063e7" ON "plugin_subscriptions" ("planId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_18db53b62833e1bdb9949b5827" ON "plugin_subscriptions" ("pluginId", "subscriberId", "tenantId") WHERE "subscriberId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_448990d16086477ee1c5f08968" ON "plugin_subscriptions" ("status", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fed0c61e1d142e1c448a45e5a0" ON "plugin_subscriptions" ("status", "endDate") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af82eaa17a59e0cf0fac16d7fe" ON "plugin_subscriptions" ("subscriberId", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb3b9c7cfe7aa86bca589aee9e" ON "plugin_subscriptions" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_billings_status_enum" AS ENUM('pending', 'processed', 'paid', 'overdue', 'failed', 'cancelled', 'refunded', 'partially_paid')`
		);
		await queryRunner.query(
			`CREATE TYPE "public"."plugin_billings_billingperiod_enum" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one-time')`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_billings" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "amount" numeric(10,2) NOT NULL, "currency" character varying NOT NULL DEFAULT 'USD', "billingDate" TIMESTAMP NOT NULL, "dueDate" TIMESTAMP NOT NULL, "status" "public"."plugin_billings_status_enum" NOT NULL DEFAULT 'pending', "billingPeriod" "public"."plugin_billings_billingperiod_enum" NOT NULL, "billingPeriodStart" TIMESTAMP NOT NULL, "billingPeriodEnd" TIMESTAMP NOT NULL, "description" text, "metadata" jsonb, "subscriptionId" uuid NOT NULL, CONSTRAINT "PK_53bbb94a70e4a89818bca2de680" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_74d0d8f22af90d92d3213d5e74" ON "plugin_billings" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2c926e12d6fba9b0d320c974f3" ON "plugin_billings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8fb8bf376857199096a73d90b8" ON "plugin_billings" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e1d678ee40f241203ee5ad7d41" ON "plugin_billings" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9e3344b0c59fcd4cd699cef727" ON "plugin_billings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7b12d1d4e5d36737596155ce2d" ON "plugin_billings" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d05232ee38835a76623154b7b" ON "plugin_billings" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_allowed_roles" ("pluginTenantsId" uuid NOT NULL, "roleId" uuid NOT NULL, CONSTRAINT "PK_770563b1a6189b3c8deff187700" PRIMARY KEY ("pluginTenantsId", "roleId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_12c6c6c88720dfb785a0e066bb" ON "plugin_tenant_allowed_roles" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0c355caddd182f2e7099d35911" ON "plugin_tenant_allowed_roles" ("roleId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_allowed_users" ("pluginTenantsId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_3fc226e3c68ee9e6d15c28e9674" PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_358b3ee7d6cac92234c829e384" ON "plugin_tenant_allowed_users" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_99cab633947d311b29e5e3d9f1" ON "plugin_tenant_allowed_users" ("userId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_denied_users" ("pluginTenantsId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "PK_04b34bee67f6a3905b9031c10ed" PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27e45daf821a522cf6c7b794bc" ON "plugin_tenant_denied_users" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17fc7d5ec9f51d9716c79b50ae" ON "plugin_tenant_denied_users" ("userId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_categories_closure" ("id_ancestor" uuid NOT NULL, "id_descendant" uuid NOT NULL, CONSTRAINT "PK_f5e8c87cd37537b34e1a8c887e9" PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6eca05af711ef729dbe99f9b63" ON "plugin_categories_closure" ("id_ancestor") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ac6e3a024785d6cd7e1dc8a7d0" ON "plugin_categories_closure" ("id_descendant") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscriptions_closure" ("id_ancestor" uuid NOT NULL, "id_descendant" uuid NOT NULL, CONSTRAINT "PK_75160b23192304669eeeeac9533" PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_31cca01b2ea11308a44475563b" ON "plugin_subscriptions_closure" ("id_ancestor") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c7a67d94dc7edfc580657a52d" ON "plugin_subscriptions_closure" ("id_descendant") `
		);
		await queryRunner.query(`ALTER TABLE "organization_project" ALTER COLUMN "status" SET DEFAULT 'open'`);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenants" ADD CONSTRAINT "FK_f209a8620f1677ed2c82c4cd2e4" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenants" ADD CONSTRAINT "FK_0b5cc71673410a449491fb3db93" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenants" ADD CONSTRAINT "FK_06f10073cd6e84a19b6f604ddd1" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenants" ADD CONSTRAINT "FK_5df2b63d82f2168e43c2d7e64c1" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenants" ADD CONSTRAINT "FK_545faee53386f4e9d7b43111047" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenants" ADD CONSTRAINT "FK_c47db2e2072ba3b570608192467" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenants" ADD CONSTRAINT "FK_52ca2ab9f943fe3f47df36aef76" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_5534e36ff3a1416c17f507d5469" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_6b8deef29d0fb5eee571c39b39b" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_a97ab238dc6aff5f305d37dbc72" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_bbced9536ca0a8ee967b531c325" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_d4504369b0f19d2360a464408ad" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_737e0935140d7b17632fc7815ad" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_8e11188fb92db2ee126b53e866e" FOREIGN KEY ("pluginTenantId") REFERENCES "plugin_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_a8471a91f63494a0d3ec5cf248c" FOREIGN KEY ("categoryId") REFERENCES "plugin_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_settings" ADD CONSTRAINT "FK_734649a34ee071f44de4a14490d" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories" ADD CONSTRAINT "FK_60543808734ff13850d7843f7b8" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories" ADD CONSTRAINT "FK_c7c4b6b97be418be173859d10da" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories" ADD CONSTRAINT "FK_1fa4520b20a0bf4fdfe3ca1ec7b" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories" ADD CONSTRAINT "FK_7c239f665e5caedd708c62b1f7a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories" ADD CONSTRAINT "FK_ca31918911db08a4008be72c8e5" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories" ADD CONSTRAINT "FK_70bfaf5965c91621dedb183bc81" FOREIGN KEY ("parentId") REFERENCES "plugin_categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tags" ADD CONSTRAINT "FK_9b013a85a6ae26db17101ffb894" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tags" ADD CONSTRAINT "FK_ee480ffb800fb2c9f6d91f66aa7" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tags" ADD CONSTRAINT "FK_09654ebaec00e0c0c4dfae4c427" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tags" ADD CONSTRAINT "FK_da359f059e06030ec33adba1335" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tags" ADD CONSTRAINT "FK_8bcd0243b780191a391b348f582" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tags" ADD CONSTRAINT "FK_05292c8750270ff028ab2fec140" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tags" ADD CONSTRAINT "FK_df3d0fc648c9e0544ca11df9d2e" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_842e5e5f94c4008a42d4b5f44a6" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_7e9b8b3eebb881753e07b73f6c6" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_a45f5c2aba22d4fa4eb8fa85af8" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_dff9e6c763c8c33b07f330e6a19" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_8aafffefdce2eb11079ec2aa755" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_547e4b71ae81ee772fa4ab79e60" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_acac58b213936ea488d0a8d1a30" FOREIGN KEY ("versionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_installations" ADD CONSTRAINT "FK_32c3f7a738ec8b40d6375b2933c" FOREIGN KEY ("installedById") REFERENCES "employee"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_sources" ADD CONSTRAINT "FK_09a383d6f2858d49c064ca4cda9" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_sources" ADD CONSTRAINT "FK_0404416b5c1cd48ae87fe81834a" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_sources" ADD CONSTRAINT "FK_c90b796bd033e54e3719213a0ce" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_sources" ADD CONSTRAINT "FK_19d9135639e3b40ec0dca1c9261" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_sources" ADD CONSTRAINT "FK_7c6dc1cdd58690b7179d76184be" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_sources" ADD CONSTRAINT "FK_55bee446d2c470e5d6b066a27a2" FOREIGN KEY ("versionId") REFERENCES "plugin_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_versions" ADD CONSTRAINT "FK_485db4d1cc977cc3d499824d958" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_versions" ADD CONSTRAINT "FK_0b36b5701e9890a395ded76cb57" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_versions" ADD CONSTRAINT "FK_e06094816e67e584dea754cc81c" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_versions" ADD CONSTRAINT "FK_650ccf2e7394509f7ad8448e323" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_versions" ADD CONSTRAINT "FK_f806bae81cd490404a1888ad5b9" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_versions" ADD CONSTRAINT "FK_8adf7a9181e968bcafc71236c80" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugins" ADD CONSTRAINT "FK_cc5b64091fbfdcdbd23d6da80ee" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugins" ADD CONSTRAINT "FK_61357761fc6b140180b104dc8d5" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugins" ADD CONSTRAINT "FK_3210c015451d02d015a23eedad4" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugins" ADD CONSTRAINT "FK_16d0aed6fcc311379f5c75bbd2d" FOREIGN KEY ("categoryId") REFERENCES "plugin_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugins" ADD CONSTRAINT "FK_4bf89f98c41969e23e3f9974d56" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" ADD CONSTRAINT "FK_646aa1161ac9861061842e05c2f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" ADD CONSTRAINT "FK_b874f9ee9c04061b4892926388f" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" ADD CONSTRAINT "FK_6f401b811d14d8b06db0fbea308" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" ADD CONSTRAINT "FK_a06a8b0e7f54e73cfc92c96511b" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" ADD CONSTRAINT "FK_d3afff45d3c259d2d484387a248" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_449b2294593f5787f40a60c8f23" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_ddf7be116060ee20bc16128632d" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_0be98c36cdbaa56f3880bc6baa5" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_7f792e3c1891f728f9e52561428" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_9bbac226cce476576134c5726e2" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_052c95e24f8ac2afdea389d31e0" FOREIGN KEY ("pluginId") REFERENCES "plugins"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_6163fac447615c15bdd3cc4b108" FOREIGN KEY ("pluginTenantId") REFERENCES "plugin_tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_4e8a9f4ee7df8c39d0314063e73" FOREIGN KEY ("planId") REFERENCES "plugin_subscription_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_b76c1241cbcbe8a92cba6d7fbcd" FOREIGN KEY ("subscriberId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions" ADD CONSTRAINT "FK_39a16aca760fc7a3cef39d55638" FOREIGN KEY ("parentId") REFERENCES "plugin_subscriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_billings" ADD CONSTRAINT "FK_74d0d8f22af90d92d3213d5e74e" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_billings" ADD CONSTRAINT "FK_2c926e12d6fba9b0d320c974f32" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_billings" ADD CONSTRAINT "FK_8fb8bf376857199096a73d90b86" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_billings" ADD CONSTRAINT "FK_7b12d1d4e5d36737596155ce2d5" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_billings" ADD CONSTRAINT "FK_7d05232ee38835a76623154b7b2" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_billings" ADD CONSTRAINT "FK_3c3212b2cf3a4e6cc6896657bb1" FOREIGN KEY ("subscriptionId") REFERENCES "plugin_subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_roles" ADD CONSTRAINT "FK_12c6c6c88720dfb785a0e066bb6" FOREIGN KEY ("pluginTenantsId") REFERENCES "plugin_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_roles" ADD CONSTRAINT "FK_0c355caddd182f2e7099d359119" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_users" ADD CONSTRAINT "FK_358b3ee7d6cac92234c829e3844" FOREIGN KEY ("pluginTenantsId") REFERENCES "plugin_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_users" ADD CONSTRAINT "FK_99cab633947d311b29e5e3d9f16" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_denied_users" ADD CONSTRAINT "FK_27e45daf821a522cf6c7b794bce" FOREIGN KEY ("pluginTenantsId") REFERENCES "plugin_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_denied_users" ADD CONSTRAINT "FK_17fc7d5ec9f51d9716c79b50ae8" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories_closure" ADD CONSTRAINT "FK_6eca05af711ef729dbe99f9b634" FOREIGN KEY ("id_ancestor") REFERENCES "plugin_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories_closure" ADD CONSTRAINT "FK_ac6e3a024785d6cd7e1dc8a7d08" FOREIGN KEY ("id_descendant") REFERENCES "plugin_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions_closure" ADD CONSTRAINT "FK_31cca01b2ea11308a44475563b3" FOREIGN KEY ("id_ancestor") REFERENCES "plugin_subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions_closure" ADD CONSTRAINT "FK_9c7a67d94dc7edfc580657a52df" FOREIGN KEY ("id_descendant") REFERENCES "plugin_subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions_closure" DROP CONSTRAINT "FK_9c7a67d94dc7edfc580657a52df"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions_closure" DROP CONSTRAINT "FK_31cca01b2ea11308a44475563b3"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories_closure" DROP CONSTRAINT "FK_ac6e3a024785d6cd7e1dc8a7d08"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories_closure" DROP CONSTRAINT "FK_6eca05af711ef729dbe99f9b634"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_denied_users" DROP CONSTRAINT "FK_17fc7d5ec9f51d9716c79b50ae8"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_denied_users" DROP CONSTRAINT "FK_27e45daf821a522cf6c7b794bce"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_users" DROP CONSTRAINT "FK_99cab633947d311b29e5e3d9f16"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_users" DROP CONSTRAINT "FK_358b3ee7d6cac92234c829e3844"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_roles" DROP CONSTRAINT "FK_0c355caddd182f2e7099d359119"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_roles" DROP CONSTRAINT "FK_12c6c6c88720dfb785a0e066bb6"`
		);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(`ALTER TABLE "plugin_billings" DROP CONSTRAINT "FK_3c3212b2cf3a4e6cc6896657bb1"`);
		await queryRunner.query(`ALTER TABLE "plugin_billings" DROP CONSTRAINT "FK_7d05232ee38835a76623154b7b2"`);
		await queryRunner.query(`ALTER TABLE "plugin_billings" DROP CONSTRAINT "FK_7b12d1d4e5d36737596155ce2d5"`);
		await queryRunner.query(`ALTER TABLE "plugin_billings" DROP CONSTRAINT "FK_8fb8bf376857199096a73d90b86"`);
		await queryRunner.query(`ALTER TABLE "plugin_billings" DROP CONSTRAINT "FK_2c926e12d6fba9b0d320c974f32"`);
		await queryRunner.query(`ALTER TABLE "plugin_billings" DROP CONSTRAINT "FK_74d0d8f22af90d92d3213d5e74e"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_39a16aca760fc7a3cef39d55638"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_b76c1241cbcbe8a92cba6d7fbcd"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_4e8a9f4ee7df8c39d0314063e73"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_6163fac447615c15bdd3cc4b108"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_052c95e24f8ac2afdea389d31e0"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_9bbac226cce476576134c5726e2"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_7f792e3c1891f728f9e52561428"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_0be98c36cdbaa56f3880bc6baa5"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_ddf7be116060ee20bc16128632d"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" DROP CONSTRAINT "FK_449b2294593f5787f40a60c8f23"`);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" DROP CONSTRAINT "FK_d3afff45d3c259d2d484387a248"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" DROP CONSTRAINT "FK_a06a8b0e7f54e73cfc92c96511b"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" DROP CONSTRAINT "FK_6f401b811d14d8b06db0fbea308"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" DROP CONSTRAINT "FK_b874f9ee9c04061b4892926388f"`
		);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" DROP CONSTRAINT "FK_646aa1161ac9861061842e05c2f"`
		);
		await queryRunner.query(`ALTER TABLE "plugins" DROP CONSTRAINT "FK_4bf89f98c41969e23e3f9974d56"`);
		await queryRunner.query(`ALTER TABLE "plugins" DROP CONSTRAINT "FK_16d0aed6fcc311379f5c75bbd2d"`);
		await queryRunner.query(`ALTER TABLE "plugins" DROP CONSTRAINT "FK_3210c015451d02d015a23eedad4"`);
		await queryRunner.query(`ALTER TABLE "plugins" DROP CONSTRAINT "FK_61357761fc6b140180b104dc8d5"`);
		await queryRunner.query(`ALTER TABLE "plugins" DROP CONSTRAINT "FK_cc5b64091fbfdcdbd23d6da80ee"`);
		await queryRunner.query(`ALTER TABLE "plugin_versions" DROP CONSTRAINT "FK_8adf7a9181e968bcafc71236c80"`);
		await queryRunner.query(`ALTER TABLE "plugin_versions" DROP CONSTRAINT "FK_f806bae81cd490404a1888ad5b9"`);
		await queryRunner.query(`ALTER TABLE "plugin_versions" DROP CONSTRAINT "FK_650ccf2e7394509f7ad8448e323"`);
		await queryRunner.query(`ALTER TABLE "plugin_versions" DROP CONSTRAINT "FK_e06094816e67e584dea754cc81c"`);
		await queryRunner.query(`ALTER TABLE "plugin_versions" DROP CONSTRAINT "FK_0b36b5701e9890a395ded76cb57"`);
		await queryRunner.query(`ALTER TABLE "plugin_versions" DROP CONSTRAINT "FK_485db4d1cc977cc3d499824d958"`);
		await queryRunner.query(`ALTER TABLE "plugin_sources" DROP CONSTRAINT "FK_55bee446d2c470e5d6b066a27a2"`);
		await queryRunner.query(`ALTER TABLE "plugin_sources" DROP CONSTRAINT "FK_7c6dc1cdd58690b7179d76184be"`);
		await queryRunner.query(`ALTER TABLE "plugin_sources" DROP CONSTRAINT "FK_19d9135639e3b40ec0dca1c9261"`);
		await queryRunner.query(`ALTER TABLE "plugin_sources" DROP CONSTRAINT "FK_c90b796bd033e54e3719213a0ce"`);
		await queryRunner.query(`ALTER TABLE "plugin_sources" DROP CONSTRAINT "FK_0404416b5c1cd48ae87fe81834a"`);
		await queryRunner.query(`ALTER TABLE "plugin_sources" DROP CONSTRAINT "FK_09a383d6f2858d49c064ca4cda9"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_32c3f7a738ec8b40d6375b2933c"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_acac58b213936ea488d0a8d1a30"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_547e4b71ae81ee772fa4ab79e60"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_8aafffefdce2eb11079ec2aa755"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_dff9e6c763c8c33b07f330e6a19"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_a45f5c2aba22d4fa4eb8fa85af8"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_7e9b8b3eebb881753e07b73f6c6"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" DROP CONSTRAINT "FK_842e5e5f94c4008a42d4b5f44a6"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" DROP CONSTRAINT "FK_df3d0fc648c9e0544ca11df9d2e"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" DROP CONSTRAINT "FK_05292c8750270ff028ab2fec140"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" DROP CONSTRAINT "FK_8bcd0243b780191a391b348f582"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" DROP CONSTRAINT "FK_da359f059e06030ec33adba1335"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" DROP CONSTRAINT "FK_09654ebaec00e0c0c4dfae4c427"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" DROP CONSTRAINT "FK_ee480ffb800fb2c9f6d91f66aa7"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" DROP CONSTRAINT "FK_9b013a85a6ae26db17101ffb894"`);
		await queryRunner.query(`ALTER TABLE "plugin_categories" DROP CONSTRAINT "FK_70bfaf5965c91621dedb183bc81"`);
		await queryRunner.query(`ALTER TABLE "plugin_categories" DROP CONSTRAINT "FK_ca31918911db08a4008be72c8e5"`);
		await queryRunner.query(`ALTER TABLE "plugin_categories" DROP CONSTRAINT "FK_7c239f665e5caedd708c62b1f7a"`);
		await queryRunner.query(`ALTER TABLE "plugin_categories" DROP CONSTRAINT "FK_1fa4520b20a0bf4fdfe3ca1ec7b"`);
		await queryRunner.query(`ALTER TABLE "plugin_categories" DROP CONSTRAINT "FK_c7c4b6b97be418be173859d10da"`);
		await queryRunner.query(`ALTER TABLE "plugin_categories" DROP CONSTRAINT "FK_60543808734ff13850d7843f7b8"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_734649a34ee071f44de4a14490d"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_a8471a91f63494a0d3ec5cf248c"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_8e11188fb92db2ee126b53e866e"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_737e0935140d7b17632fc7815ad"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_d4504369b0f19d2360a464408ad"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_bbced9536ca0a8ee967b531c325"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_a97ab238dc6aff5f305d37dbc72"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_6b8deef29d0fb5eee571c39b39b"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" DROP CONSTRAINT "FK_5534e36ff3a1416c17f507d5469"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" DROP CONSTRAINT "FK_52ca2ab9f943fe3f47df36aef76"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" DROP CONSTRAINT "FK_c47db2e2072ba3b570608192467"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" DROP CONSTRAINT "FK_545faee53386f4e9d7b43111047"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" DROP CONSTRAINT "FK_5df2b63d82f2168e43c2d7e64c1"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" DROP CONSTRAINT "FK_06f10073cd6e84a19b6f604ddd1"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" DROP CONSTRAINT "FK_0b5cc71673410a449491fb3db93"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" DROP CONSTRAINT "FK_f209a8620f1677ed2c82c4cd2e4"`);
		await queryRunner.query(`ALTER TABLE "organization_project" ALTER COLUMN "status" DROP DEFAULT`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9c7a67d94dc7edfc580657a52d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_31cca01b2ea11308a44475563b"`);
		await queryRunner.query(`DROP TABLE "plugin_subscriptions_closure"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ac6e3a024785d6cd7e1dc8a7d0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6eca05af711ef729dbe99f9b63"`);
		await queryRunner.query(`DROP TABLE "plugin_categories_closure"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_17fc7d5ec9f51d9716c79b50ae"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_27e45daf821a522cf6c7b794bc"`);
		await queryRunner.query(`DROP TABLE "plugin_tenant_denied_users"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_99cab633947d311b29e5e3d9f1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_358b3ee7d6cac92234c829e384"`);
		await queryRunner.query(`DROP TABLE "plugin_tenant_allowed_users"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0c355caddd182f2e7099d35911"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_12c6c6c88720dfb785a0e066bb"`);
		await queryRunner.query(`DROP TABLE "plugin_tenant_allowed_roles"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7d05232ee38835a76623154b7b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7b12d1d4e5d36737596155ce2d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9e3344b0c59fcd4cd699cef727"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e1d678ee40f241203ee5ad7d41"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8fb8bf376857199096a73d90b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_2c926e12d6fba9b0d320c974f3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_74d0d8f22af90d92d3213d5e74"`);
		await queryRunner.query(`DROP TABLE "plugin_billings"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_billings_billingperiod_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_billings_status_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_eb3b9c7cfe7aa86bca589aee9e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_af82eaa17a59e0cf0fac16d7fe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fed0c61e1d142e1c448a45e5a0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_448990d16086477ee1c5f08968"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_18db53b62833e1bdb9949b5827"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4e8a9f4ee7df8c39d0314063e7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bbd6dc08c0c91724e5d26202fa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_39a16aca760fc7a3cef39d5563"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7afeffe18364cae48efd454e4d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9bbac226cce476576134c5726e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7f792e3c1891f728f9e5256142"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b5163f874ce5bc6b63c8e8631a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_18743cb5933b78e2b8081589e4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0be98c36cdbaa56f3880bc6baa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ddf7be116060ee20bc16128632"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_449b2294593f5787f40a60c8f2"`);
		await queryRunner.query(`DROP TABLE "plugin_subscriptions"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_subscriptions_scope_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_subscriptions_status_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_082f6cba880ecd144b28284376"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_37c9e1c698331b9345280374fd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_234c8f3d694ae31b095bdf5a8a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dec9037a57726ae5f54bc3c4a8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a7bf8b446ca66e5824fb6ff91a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6f401b811d14d8b06db0fbea30"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b874f9ee9c04061b4892926388"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_646aa1161ac9861061842e05c2"`);
		await queryRunner.query(`DROP TABLE "plugin_subscription_plans"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_subscription_plans_billingperiod_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_subscription_plans_type_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0479844f05c1132f8929cab1c8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6c8d4a0f437cfae296ef43ce13"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c0fab3c6709a93bca88eb100a9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_123f1b37f4826f6241446a8416"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_15ca158f27ab3296915b7d1b38"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4bf89f98c41969e23e3f9974d5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16d0aed6fcc311379f5c75bbd2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_100eef6409ee96d0673ee510e6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_35ee1cb5098e17e30ee5cbc705"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c61c7032e7b3afd352d82bc4b4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d0a1444aa92229d7f1af237184"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3210c015451d02d015a23eedad"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_61357761fc6b140180b104dc8d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cc5b64091fbfdcdbd23d6da80e"`);
		await queryRunner.query(`DROP TABLE "plugins"`);
		await queryRunner.query(`DROP TYPE "public"."plugins_status_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugins_type_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_39d060301c8a36b51da6e4aec3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f5c8259c0d815486f31878864d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e1e7cf1589d06ac02a12e41db0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e632aa70ea7b7e5c5fdbfba41b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6fa0eda3add1fb070ba172a44e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8adf7a9181e968bcafc71236c8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ab6e29cd444226f80bf0c0c1db"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f806bae81cd490404a1888ad5b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_650ccf2e7394509f7ad8448e32"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a16869769b9a219acb157bb2b3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e6d49799b916946e5cd5399385"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e06094816e67e584dea754cc81"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0b36b5701e9890a395ded76cb5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_485db4d1cc977cc3d499824d95"`);
		await queryRunner.query(`DROP TABLE "plugin_versions"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6fae6d0ddfd7177abcb4befd72"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_af8978fbf37560525c19ec7048"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d658bc853b354445cf2a0d6fb7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_55bee446d2c470e5d6b066a27a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7c6dc1cdd58690b7179d76184b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_19d9135639e3b40ec0dca1c926"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0ab83b39cc676ee2097714fb3b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cb9a1e5640b8e07a9a63b51245"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c90b796bd033e54e3719213a0c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0404416b5c1cd48ae87fe81834"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_09a383d6f2858d49c064ca4cda"`);
		await queryRunner.query(`DROP TABLE "plugin_sources"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_sources_storageprovider_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_sources_architecture_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_sources_operatingsystem_enum"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_sources_type_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1569d8ca526d958d82483e15c7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_173e0668b17afd3696abf3c518"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3c3ce338e7716d853220d8b176"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5e6b80341a4ed75ae7c4af6897"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c92ea21dfcfd889730e2214c8f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_28624735b4e3ace75883521a57"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_32c3f7a738ec8b40d6375b2933"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_acac58b213936ea488d0a8d1a3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_547e4b71ae81ee772fa4ab79e6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8aafffefdce2eb11079ec2aa75"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dff9e6c763c8c33b07f330e6a1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_3e63eed07bcc0e3e36d9183cca"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d742ed346264f4c9d9225265d7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a45f5c2aba22d4fa4eb8fa85af"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7e9b8b3eebb881753e07b73f6c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_842e5e5f94c4008a42d4b5f44a"`);
		await queryRunner.query(`DROP TABLE "plugin_installations"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_installations_status_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_676e7c749905331c36b1707ba8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cddb5e04a93a957dc4d56522b7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_17c923b300710a13f6dfade59b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_df3d0fc648c9e0544ca11df9d2"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_05292c8750270ff028ab2fec14"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8bcd0243b780191a391b348f58"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_da359f059e06030ec33adba133"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cacbb5fd767b06985be6049858"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_fe4db46e2c3d32f64b4a4728e3"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_09654ebaec00e0c0c4dfae4c42"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ee480ffb800fb2c9f6d91f66aa"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9b013a85a6ae26db17101ffb89"`);
		await queryRunner.query(`DROP TABLE "plugin_tags"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ca31918911db08a4008be72c8e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7c239f665e5caedd708c62b1f7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b23665ef0d73dbe47d4d26f3d5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_99ab190a6b7ae5ffc61b4dfaf4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1fa4520b20a0bf4fdfe3ca1ec7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c7c4b6b97be418be173859d10d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_60543808734ff13850d7843f7b"`);
		await queryRunner.query(`DROP TABLE "plugin_categories"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_48aa394150a960cf3e7b285cf4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_734649a34ee071f44de4a14490"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a8471a91f63494a0d3ec5cf248"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8e11188fb92db2ee126b53e866"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_737e0935140d7b17632fc7815a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d4504369b0f19d2360a464408a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_bbced9536ca0a8ee967b531c32"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_199b3708ea7962d21fc55de243"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cf20745f234b0b3512c03d74be"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a97ab238dc6aff5f305d37dbc7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6b8deef29d0fb5eee571c39b39"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5534e36ff3a1416c17f507d546"`);
		await queryRunner.query(`DROP TABLE "plugin_settings"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_settings_datatype_enum"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1394aebfcfe6782051e76f46a5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a3a616a07b21a4212736493f5e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_69f72957e1c98832cdab0c486e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4f1dada611375594ce22411cbe"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_52ca2ab9f943fe3f47df36aef7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a32259b1b9cdeea1c6d94bf94c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1aca41d7ee08b3b140eae4ee88"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c4accce384c6007c92b9afdc2d"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e723cb5fdc4092538fe0384853"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6d6a338f4eb5b467c2ff5eaa4b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c47db2e2072ba3b57060819246"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_545faee53386f4e9d7b4311104"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_5df2b63d82f2168e43c2d7e64c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0ed7c977facb534e572d33b485"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cf185e176c869e2be48d00d648"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_06f10073cd6e84a19b6f604ddd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_0b5cc71673410a449491fb3db9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f209a8620f1677ed2c82c4cd2e"`);
		await queryRunner.query(`DROP TABLE "plugin_tenants"`);
		await queryRunner.query(`DROP TYPE "public"."plugin_tenants_scope_enum"`);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenants" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar NOT NULL, "enabled" boolean NOT NULL DEFAULT (1), "scope" varchar CHECK( "scope" IN ('tenant','organization','user') ) NOT NULL DEFAULT ('user'), "autoInstall" boolean NOT NULL DEFAULT (0), "requiresApproval" boolean NOT NULL DEFAULT (1), "isMandatory" boolean NOT NULL DEFAULT (0), "maxInstallations" integer, "maxActiveUsers" integer, "currentInstallations" integer NOT NULL DEFAULT (0), "currentActiveUsers" integer NOT NULL DEFAULT (0), "tenantConfiguration" text, "preferences" text, "approvedAt" text, "isDataCompliant" boolean NOT NULL DEFAULT (1), "complianceCertifications" text, "approvedById" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f209a8620f1677ed2c82c4cd2e" ON "plugin_tenants" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b5cc71673410a449491fb3db9" ON "plugin_tenants" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_06f10073cd6e84a19b6f604ddd" ON "plugin_tenants" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cf185e176c869e2be48d00d648" ON "plugin_tenants" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ed7c977facb534e572d33b485" ON "plugin_tenants" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_5df2b63d82f2168e43c2d7e64c" ON "plugin_tenants" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_545faee53386f4e9d7b4311104" ON "plugin_tenants" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c47db2e2072ba3b57060819246" ON "plugin_tenants" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d6a338f4eb5b467c2ff5eaa4b" ON "plugin_tenants" ("enabled") `);
		await queryRunner.query(`CREATE INDEX "IDX_e723cb5fdc4092538fe0384853" ON "plugin_tenants" ("scope") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4accce384c6007c92b9afdc2d" ON "plugin_tenants" ("currentInstallations") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1aca41d7ee08b3b140eae4ee88" ON "plugin_tenants" ("currentActiveUsers") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a32259b1b9cdeea1c6d94bf94c" ON "plugin_tenants" ("approvedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_52ca2ab9f943fe3f47df36aef7" ON "plugin_tenants" ("approvedById") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4f1dada611375594ce22411cbe" ON "plugin_tenants" ("pluginId", "enabled") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_69f72957e1c98832cdab0c486e" ON "plugin_tenants" ("organizationId", "scope") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a3a616a07b21a4212736493f5e" ON "plugin_tenants" ("tenantId", "scope", "enabled") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1394aebfcfe6782051e76f46a5" ON "plugin_tenants" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_settings" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "key" varchar NOT NULL, "value" text NOT NULL, "isRequired" boolean NOT NULL DEFAULT (0), "isEncrypted" boolean NOT NULL DEFAULT (0), "description" text, "order" integer, "validationRules" text, "dataType" varchar CHECK( "dataType" IN ('string','number','boolean','json','file') ) NOT NULL DEFAULT ('string'), "defaultValue" varchar, "pluginId" varchar NOT NULL, "pluginTenantId" varchar, "categoryId" varchar, "updatedById" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5534e36ff3a1416c17f507d546" ON "plugin_settings" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b8deef29d0fb5eee571c39b39" ON "plugin_settings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a97ab238dc6aff5f305d37dbc7" ON "plugin_settings" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cf20745f234b0b3512c03d74be" ON "plugin_settings" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_199b3708ea7962d21fc55de243" ON "plugin_settings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_bbced9536ca0a8ee967b531c32" ON "plugin_settings" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d4504369b0f19d2360a464408a" ON "plugin_settings" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_737e0935140d7b17632fc7815a" ON "plugin_settings" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8e11188fb92db2ee126b53e866" ON "plugin_settings" ("pluginTenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a8471a91f63494a0d3ec5cf248" ON "plugin_settings" ("categoryId") `);
		await queryRunner.query(`CREATE INDEX "IDX_734649a34ee071f44de4a14490" ON "plugin_settings" ("updatedById") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_48aa394150a960cf3e7b285cf4" ON "plugin_settings" ("pluginId", "key", "pluginTenantId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_categories" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "slug" varchar NOT NULL, "color" varchar, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "metadata" text, "parentId" varchar, CONSTRAINT "UQ_d427c34c4dd721c72d5d56187f9" UNIQUE ("slug"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_60543808734ff13850d7843f7b" ON "plugin_categories" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4b6b97be418be173859d10d" ON "plugin_categories" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1fa4520b20a0bf4fdfe3ca1ec7" ON "plugin_categories" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_99ab190a6b7ae5ffc61b4dfaf4" ON "plugin_categories" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b23665ef0d73dbe47d4d26f3d5" ON "plugin_categories" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c239f665e5caedd708c62b1f7" ON "plugin_categories" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca31918911db08a4008be72c8e" ON "plugin_categories" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tags" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar NOT NULL, "tagId" varchar NOT NULL, "appliedAt" text DEFAULT (CURRENT_TIMESTAMP), "appliedById" varchar, "priority" integer DEFAULT (50), "isFeatured" boolean NOT NULL DEFAULT (0))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_9b013a85a6ae26db17101ffb89" ON "plugin_tags" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee480ffb800fb2c9f6d91f66aa" ON "plugin_tags" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_09654ebaec00e0c0c4dfae4c42" ON "plugin_tags" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fe4db46e2c3d32f64b4a4728e3" ON "plugin_tags" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_cacbb5fd767b06985be6049858" ON "plugin_tags" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_da359f059e06030ec33adba133" ON "plugin_tags" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8bcd0243b780191a391b348f58" ON "plugin_tags" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_05292c8750270ff028ab2fec14" ON "plugin_tags" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_df3d0fc648c9e0544ca11df9d2" ON "plugin_tags" ("tagId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_17c923b300710a13f6dfade59b" ON "plugin_tags" ("tagId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cddb5e04a93a957dc4d56522b7" ON "plugin_tags" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_676e7c749905331c36b1707ba8" ON "plugin_tags" ("pluginId", "tagId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_installations" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar(36), "versionId" varchar(36), "installedById" varchar(36), "installedAt" datetime, "uninstalledAt" datetime, "status" varchar CHECK( "status" IN ('INSTALLED','UNINSTALLED','FAILED','IN_PROGRESS') ) NOT NULL DEFAULT ('IN_PROGRESS'), "isActivated" boolean NOT NULL DEFAULT (0), "activatedAt" datetime, "deactivatedAt" datetime)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_842e5e5f94c4008a42d4b5f44a" ON "plugin_installations" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7e9b8b3eebb881753e07b73f6c" ON "plugin_installations" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a45f5c2aba22d4fa4eb8fa85af" ON "plugin_installations" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d742ed346264f4c9d9225265d7" ON "plugin_installations" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3e63eed07bcc0e3e36d9183cca" ON "plugin_installations" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dff9e6c763c8c33b07f330e6a1" ON "plugin_installations" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aafffefdce2eb11079ec2aa75" ON "plugin_installations" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_547e4b71ae81ee772fa4ab79e6" ON "plugin_installations" ("pluginId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_acac58b213936ea488d0a8d1a3" ON "plugin_installations" ("versionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_32c3f7a738ec8b40d6375b2933" ON "plugin_installations" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_28624735b4e3ace75883521a57" ON "plugin_installations" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c92ea21dfcfd889730e2214c8f" ON "plugin_installations" ("uninstalledAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e6b80341a4ed75ae7c4af6897" ON "plugin_installations" ("activatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3c3ce338e7716d853220d8b176" ON "plugin_installations" ("deactivatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_173e0668b17afd3696abf3c518" ON "plugin_installations" ("installedById", "pluginId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1569d8ca526d958d82483e15c7" ON "plugin_installations" ("pluginId", "tenantId", "organizationId", "installedById") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_sources" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "operatingSystem" varchar CHECK( "operatingSystem" IN ('LINUX','MAC','WINDOWS','UNIVERSAL') ) NOT NULL DEFAULT ('UNIVERSAL'), "architecture" varchar CHECK( "architecture" IN ('X64','ARM') ) NOT NULL DEFAULT ('X64'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "private" boolean DEFAULT (0), "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "versionId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_09a383d6f2858d49c064ca4cda" ON "plugin_sources" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0404416b5c1cd48ae87fe81834" ON "plugin_sources" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c90b796bd033e54e3719213a0c" ON "plugin_sources" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cb9a1e5640b8e07a9a63b51245" ON "plugin_sources" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ab83b39cc676ee2097714fb3b" ON "plugin_sources" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_19d9135639e3b40ec0dca1c926" ON "plugin_sources" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7c6dc1cdd58690b7179d76184b" ON "plugin_sources" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_55bee446d2c470e5d6b066a27a" ON "plugin_sources" ("versionId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d658bc853b354445cf2a0d6fb7" ON "plugin_sources" ("storageProvider") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af8978fbf37560525c19ec7048" ON "plugin_sources" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6fae6d0ddfd7177abcb4befd72" ON "plugin_sources" ("versionId", "operatingSystem", "architecture", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_versions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_485db4d1cc977cc3d499824d95" ON "plugin_versions" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b36b5701e9890a395ded76cb5" ON "plugin_versions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e06094816e67e584dea754cc81" ON "plugin_versions" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e6d49799b916946e5cd5399385" ON "plugin_versions" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_a16869769b9a219acb157bb2b3" ON "plugin_versions" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_650ccf2e7394509f7ad8448e32" ON "plugin_versions" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f806bae81cd490404a1888ad5b" ON "plugin_versions" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ab6e29cd444226f80bf0c0c1db" ON "plugin_versions" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_8adf7a9181e968bcafc71236c8" ON "plugin_versions" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fa0eda3add1fb070ba172a44e" ON "plugin_versions" ("downloadCount") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e632aa70ea7b7e5c5fdbfba41b" ON "plugin_versions" ("number") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e1e7cf1589d06ac02a12e41db0" ON "plugin_versions" ("pluginId", "releaseDate") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f5c8259c0d815486f31878864d" ON "plugin_versions" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_39d060301c8a36b51da6e4aec3" ON "plugin_versions" ("pluginId", "organizationId", "number") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugins" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "name" varchar NOT NULL, "description" varchar, "type" varchar CHECK( "type" IN ('DESKTOP','WEB','MOBILE') ) NOT NULL DEFAULT ('DESKTOP'), "status" varchar CHECK( "status" IN ('ACTIVE','INACTIVE','DEPRECATED','ARCHIVED') ) NOT NULL DEFAULT ('ACTIVE'), "categoryId" varchar, "author" varchar, "license" varchar, "homepage" varchar, "repository" varchar, "uploadedById" varchar, "uploadedAt" datetime, "requiresSubscription" boolean NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "isVerified" boolean NOT NULL DEFAULT (0), "lastDownloadedAt" datetime)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_cc5b64091fbfdcdbd23d6da80e" ON "plugins" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_61357761fc6b140180b104dc8d" ON "plugins" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3210c015451d02d015a23eedad" ON "plugins" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d0a1444aa92229d7f1af237184" ON "plugins" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c61c7032e7b3afd352d82bc4b4" ON "plugins" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_35ee1cb5098e17e30ee5cbc705" ON "plugins" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_100eef6409ee96d0673ee510e6" ON "plugins" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_16d0aed6fcc311379f5c75bbd2" ON "plugins" ("categoryId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4bf89f98c41969e23e3f9974d5" ON "plugins" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_15ca158f27ab3296915b7d1b38" ON "plugins" ("isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_123f1b37f4826f6241446a8416" ON "plugins" ("isVerified") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0fab3c6709a93bca88eb100a9" ON "plugins" ("status", "isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_6c8d4a0f437cfae296ef43ce13" ON "plugins" ("status", "type") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0479844f05c1132f8929cab1c8" ON "plugins" ("name") `);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscription_plans" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "name" varchar NOT NULL, "description" text, "type" varchar CHECK( "type" IN ('free','trial','basic','premium','enterprise','custom') ) NOT NULL DEFAULT ('free'), "price" decimal(10,2) NOT NULL DEFAULT (0), "currency" varchar(3) NOT NULL DEFAULT ('USD'), "billingPeriod" varchar CHECK( "billingPeriod" IN ('daily','weekly','monthly','quarterly','yearly','one-time') ) NOT NULL DEFAULT ('monthly'), "features" text NOT NULL, "limitations" text, "isPopular" boolean NOT NULL DEFAULT (0), "isRecommended" boolean NOT NULL DEFAULT (0), "trialDays" integer, "setupFee" decimal(10,2), "discountPercentage" decimal(5,2), "metadata" text, "sortOrder" integer NOT NULL DEFAULT (0), "pluginId" varchar NOT NULL, "createdById" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_646aa1161ac9861061842e05c2" ON "plugin_subscription_plans" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b874f9ee9c04061b4892926388" ON "plugin_subscription_plans" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f401b811d14d8b06db0fbea30" ON "plugin_subscription_plans" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7bf8b446ca66e5824fb6ff91a" ON "plugin_subscription_plans" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dec9037a57726ae5f54bc3c4a8" ON "plugin_subscription_plans" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_234c8f3d694ae31b095bdf5a8a" ON "plugin_subscription_plans" ("price", "billingPeriod") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_37c9e1c698331b9345280374fd" ON "plugin_subscription_plans" ("isActive", "type") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_082f6cba880ecd144b28284376" ON "plugin_subscription_plans" ("pluginId", "type") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscriptions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar CHECK( "status" IN ('active','cancelled','expired','trial','past_due','suspended','pending') ) NOT NULL DEFAULT ('pending'), "scope" varchar CHECK( "scope" IN ('tenant','organization','user') ) NOT NULL DEFAULT ('tenant'), "startDate" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "endDate" datetime, "trialEndDate" datetime, "autoRenew" boolean NOT NULL DEFAULT (1), "cancelledAt" datetime, "cancellationReason" text, "metadata" text, "externalSubscriptionId" varchar, "pluginId" varchar NOT NULL, "pluginTenantId" varchar NOT NULL, "planId" varchar, "subscriberId" varchar, "parentId" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_449b2294593f5787f40a60c8f2" ON "plugin_subscriptions" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ddf7be116060ee20bc16128632" ON "plugin_subscriptions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0be98c36cdbaa56f3880bc6baa" ON "plugin_subscriptions" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18743cb5933b78e2b8081589e4" ON "plugin_subscriptions" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b5163f874ce5bc6b63c8e8631a" ON "plugin_subscriptions" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7f792e3c1891f728f9e5256142" ON "plugin_subscriptions" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9bbac226cce476576134c5726e" ON "plugin_subscriptions" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7afeffe18364cae48efd454e4d" ON "plugin_subscriptions" ("scope", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_39a16aca760fc7a3cef39d5563" ON "plugin_subscriptions" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bbd6dc08c0c91724e5d26202fa" ON "plugin_subscriptions" ("externalSubscriptionId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_4e8a9f4ee7df8c39d0314063e7" ON "plugin_subscriptions" ("planId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_18db53b62833e1bdb9949b5827" ON "plugin_subscriptions" ("pluginId", "subscriberId", "tenantId") WHERE "subscriberId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_448990d16086477ee1c5f08968" ON "plugin_subscriptions" ("status", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fed0c61e1d142e1c448a45e5a0" ON "plugin_subscriptions" ("status", "endDate") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af82eaa17a59e0cf0fac16d7fe" ON "plugin_subscriptions" ("subscriberId", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb3b9c7cfe7aa86bca589aee9e" ON "plugin_subscriptions" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_billings" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "amount" decimal(10,2) NOT NULL, "currency" varchar NOT NULL DEFAULT ('USD'), "billingDate" datetime NOT NULL, "dueDate" datetime NOT NULL, "status" varchar CHECK( "status" IN ('pending','processed','paid','overdue','failed','cancelled','refunded','partially_paid') ) NOT NULL DEFAULT ('pending'), "billingPeriod" varchar CHECK( "billingPeriod" IN ('daily','weekly','monthly','quarterly','yearly','one-time') ) NOT NULL, "billingPeriodStart" datetime NOT NULL, "billingPeriodEnd" datetime NOT NULL, "description" text, "metadata" text, "subscriptionId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_74d0d8f22af90d92d3213d5e74" ON "plugin_billings" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2c926e12d6fba9b0d320c974f3" ON "plugin_billings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8fb8bf376857199096a73d90b8" ON "plugin_billings" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e1d678ee40f241203ee5ad7d41" ON "plugin_billings" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9e3344b0c59fcd4cd699cef727" ON "plugin_billings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7b12d1d4e5d36737596155ce2d" ON "plugin_billings" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d05232ee38835a76623154b7b" ON "plugin_billings" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_allowed_roles" ("pluginTenantsId" varchar NOT NULL, "roleId" varchar NOT NULL, PRIMARY KEY ("pluginTenantsId", "roleId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_12c6c6c88720dfb785a0e066bb" ON "plugin_tenant_allowed_roles" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0c355caddd182f2e7099d35911" ON "plugin_tenant_allowed_roles" ("roleId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_allowed_users" ("pluginTenantsId" varchar NOT NULL, "userId" varchar NOT NULL, PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_358b3ee7d6cac92234c829e384" ON "plugin_tenant_allowed_users" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_99cab633947d311b29e5e3d9f1" ON "plugin_tenant_allowed_users" ("userId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_denied_users" ("pluginTenantsId" varchar NOT NULL, "userId" varchar NOT NULL, PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27e45daf821a522cf6c7b794bc" ON "plugin_tenant_denied_users" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17fc7d5ec9f51d9716c79b50ae" ON "plugin_tenant_denied_users" ("userId") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_categories_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6eca05af711ef729dbe99f9b63" ON "plugin_categories_closure" ("id_ancestor") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ac6e3a024785d6cd7e1dc8a7d0" ON "plugin_categories_closure" ("id_descendant") `
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscriptions_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_31cca01b2ea11308a44475563b" ON "plugin_subscriptions_closure" ("id_ancestor") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c7a67d94dc7edfc580657a52d" ON "plugin_subscriptions_closure" ("id_descendant") `
		);
		await queryRunner.query(`DROP INDEX "IDX_ddf5990b253db3ec7b33372131"`);
		await queryRunner.query(`DROP INDEX "IDX_175b7be641928a31521224daa8"`);
		await queryRunner.query(`DROP INDEX "IDX_510cb87f5da169e57e694d1a5c"`);
		await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
		await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
		await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
		await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
		await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
		await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
		await queryRunner.query(`DROP INDEX "IDX_71d0299329e15bb40da0e9c55b"`);
		await queryRunner.query(`DROP INDEX "IDX_6780bb4a1f9343f762c6453f17"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (0), "deletedAt" datetime, "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "upworkId" varchar, "linkedInId" varchar, "isOnline" boolean DEFAULT (0), "isTrackingTime" boolean DEFAULT (0), "minimumBillingRate" integer, "isAway" boolean DEFAULT (0), "isArchived" boolean DEFAULT (0), "fix_relational_custom_fields" boolean, "archivedAt" datetime, "allowManualTime" boolean NOT NULL DEFAULT (0), "allowModifyTime" boolean NOT NULL DEFAULT (0), "allowDeleteTime" boolean NOT NULL DEFAULT (0), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "allowAgentAppExit" boolean NOT NULL DEFAULT (1), "allowLogoutFromAgentApp" boolean NOT NULL DEFAULT (1), "trackKeyboardMouseActivity" boolean NOT NULL DEFAULT (0), "trackAllDisplays" boolean NOT NULL DEFAULT (1), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "FK_ddf5990b253db3ec7b333721312" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_71d0299329e15bb40da0e9c55b1" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6780bb4a1f9343f762c6453f175" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt", "allowManualTime", "allowModifyTime", "allowDeleteTime", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt", "allowManualTime", "allowModifyTime", "allowDeleteTime", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays" FROM "employee"`
		);
		await queryRunner.query(`DROP TABLE "employee"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee" RENAME TO "employee"`);
		await queryRunner.query(`CREATE INDEX "IDX_ddf5990b253db3ec7b33372131" ON "employee" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_175b7be641928a31521224daa8" ON "employee" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_510cb87f5da169e57e694d1a5c" ON "employee" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
		await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_71d0299329e15bb40da0e9c55b" ON "employee" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6780bb4a1f9343f762c6453f17" ON "employee" ("deletedByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_d93ae6f56a3b06ddc69ac5fc2e"`);
		await queryRunner.query(`DROP INDEX "IDX_408532f0a32e4fef8d2684a97f"`);
		await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
		await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
		await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
		await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
		await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
		await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
		await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
		await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
		await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
		await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
		await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
		await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
		await queryRunner.query(`DROP INDEX "IDX_a414a803f8de400b689c9a926a"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf"`);
		await queryRunner.query(`DROP INDEX "IDX_f44648e75dbfafe2a807bd25df"`);
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "IDX_47da91256516fc5f08685638fc"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "icon" varchar, "status" varchar DEFAULT ('open'), "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_d93ae6f56a3b06ddc69ac5fc2e8" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_408532f0a32e4fef8d2684a97f8" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_47da91256516fc5f08685638fca" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "organization_project"`
		);
		await queryRunner.query(`DROP TABLE "organization_project"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_project" RENAME TO "organization_project"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_d93ae6f56a3b06ddc69ac5fc2e" ON "organization_project" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_408532f0a32e4fef8d2684a97f" ON "organization_project" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a414a803f8de400b689c9a926a" ON "organization_project" ("icon") `);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf" ON "organization_project" ("archiveTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f44648e75dbfafe2a807bd25df" ON "organization_project" ("closeTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_47da91256516fc5f08685638fc" ON "organization_project" ("updatedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_45db25594e621f1629a9fd69b9"`);
		await queryRunner.query(`DROP INDEX "IDX_b2091c1795f1d0d919b278ab23"`);
		await queryRunner.query(`DROP INDEX "IDX_6de52b8f3de32abee3df2628a3"`);
		await queryRunner.query(`DROP INDEX "IDX_745a293c8b2c750bc421fa0633"`);
		await queryRunner.query(`DROP INDEX "IDX_c21e615583a3ebbb0977452afb"`);
		await queryRunner.query(`DROP INDEX "IDX_03e5eecc2328eb545ff748cbdd"`);
		await queryRunner.query(`DROP INDEX "IDX_40460ab803bf6e5a62b75a35c5"`);
		await queryRunner.query(`DROP INDEX "IDX_6cc2b2052744e352834a4c9e78"`);
		await queryRunner.query(`DROP INDEX "IDX_b03a8a28f6ebdb6df8f630216b"`);
		await queryRunner.query(`DROP INDEX "IDX_f37d866c3326eca5f579cef35c"`);
		await queryRunner.query(`DROP INDEX "IDX_c75285bf286b17c7ca5537857b"`);
		await queryRunner.query(`DROP INDEX "IDX_9ea70bf5c390b00e7bb96b86ed"`);
		await queryRunner.query(`DROP INDEX "IDX_15458cef74076623c270500053"`);
		await queryRunner.query(`DROP INDEX "IDX_2360aa7a4b5ab99e026584f305"`);
		await queryRunner.query(`DROP INDEX "IDX_7965db2b12872551b586f76dd7"`);
		await queryRunner.query(`DROP INDEX "IDX_47b6a97e09895a06606a4a8042"`);
		await queryRunner.query(`DROP INDEX "IDX_c9b171391d920c279fae8a1bf2"`);
		await queryRunner.query(`DROP INDEX "IDX_636b2ccafeee793bb7edc5a591"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_organization" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "profile_link" varchar, "banner" varchar, "totalEmployees" integer, "short_description" varchar, "client_focus" varchar, "overview" varchar, "imageUrl" varchar(500), "currency" varchar NOT NULL, "valueDate" datetime, "defaultValueDateType" varchar CHECK( "defaultValueDateType" IN ('TODAY','END_OF_MONTH','START_OF_MONTH') ) DEFAULT ('TODAY'), "isActive" boolean DEFAULT (1), "defaultAlignmentType" varchar, "timeZone" varchar, "regionCode" varchar, "brandColor" varchar, "dateFormat" varchar, "officialName" varchar, "startWeekOn" varchar, "taxId" varchar, "numberFormat" varchar, "minimumProjectSize" varchar, "bonusType" varchar, "bonusPercentage" integer, "invitesAllowed" boolean DEFAULT (1), "show_income" boolean, "show_profits" boolean, "show_bonuses_paid" boolean, "show_total_hours" boolean, "show_minimum_project_size" boolean, "show_projects_count" boolean, "show_clients_count" boolean, "show_clients" boolean, "show_employees_count" boolean, "inviteExpiryPeriod" integer, "fiscalStartDate" datetime, "fiscalEndDate" datetime, "registrationDate" datetime, "futureDateAllowed" boolean, "allowManualTime" boolean NOT NULL DEFAULT (1), "allowModifyTime" boolean NOT NULL DEFAULT (1), "allowDeleteTime" boolean NOT NULL DEFAULT (1), "requireReason" boolean NOT NULL DEFAULT (0), "requireDescription" boolean NOT NULL DEFAULT (0), "requireProject" boolean NOT NULL DEFAULT (0), "requireTask" boolean NOT NULL DEFAULT (0), "requireClient" boolean NOT NULL DEFAULT (0), "timeFormat" integer NOT NULL DEFAULT (12), "separateInvoiceItemTaxAndDiscount" boolean, "website" varchar, "fiscalInformation" varchar, "currencyPosition" varchar NOT NULL DEFAULT ('LEFT'), "discountAfterTax" boolean, "defaultStartTime" varchar, "defaultEndTime" varchar, "defaultInvoiceEstimateTerms" varchar, "convertAcceptedEstimates" boolean, "daysUntilDue" integer, "contactId" varchar, "allowTrackInactivity" boolean NOT NULL DEFAULT (1), "inactivityTimeLimit" integer NOT NULL DEFAULT (10), "activityProofDuration" integer NOT NULL DEFAULT (1), "isRemoveIdleTime" boolean NOT NULL DEFAULT (0), "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "imageId" varchar, "upworkOrganizationId" varchar, "upworkOrganizationName" varchar, "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "randomScreenshot" boolean DEFAULT (0), "trackOnSleep" boolean DEFAULT (0), "screenshotFrequency" numeric NOT NULL DEFAULT (10), "enforced" boolean DEFAULT (0), "archivedAt" datetime, "standardWorkHoursPerDay" integer DEFAULT (8), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "allowAgentAppExit" boolean NOT NULL DEFAULT (1), "allowLogoutFromAgentApp" boolean NOT NULL DEFAULT (1), "trackKeyboardMouseActivity" boolean NOT NULL DEFAULT (0), "trackAllDisplays" boolean NOT NULL DEFAULT (1), CONSTRAINT "FK_45db25594e621f1629a9fd69b90" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_745a293c8b2c750bc421fa06332" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7965db2b12872551b586f76dd79" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_47b6a97e09895a06606a4a80421" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c9b171391d920c279fae8a1bf26" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_636b2ccafeee793bb7edc5a5919" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_organization"("id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration", "isRemoveIdleTime", "allowScreenshotCapture", "imageId", "upworkOrganizationId", "upworkOrganizationName", "isArchived", "deletedAt", "randomScreenshot", "trackOnSleep", "screenshotFrequency", "enforced", "archivedAt", "standardWorkHoursPerDay", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration", "isRemoveIdleTime", "allowScreenshotCapture", "imageId", "upworkOrganizationId", "upworkOrganizationName", "isArchived", "deletedAt", "randomScreenshot", "trackOnSleep", "screenshotFrequency", "enforced", "archivedAt", "standardWorkHoursPerDay", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays" FROM "organization"`
		);
		await queryRunner.query(`DROP TABLE "organization"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization" RENAME TO "organization"`);
		await queryRunner.query(`CREATE INDEX "IDX_45db25594e621f1629a9fd69b9" ON "organization" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2091c1795f1d0d919b278ab23" ON "organization" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_6de52b8f3de32abee3df2628a3" ON "organization" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_745a293c8b2c750bc421fa0633" ON "organization" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c21e615583a3ebbb0977452afb" ON "organization" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_03e5eecc2328eb545ff748cbdd" ON "organization" ("isDefault") `);
		await queryRunner.query(`CREATE INDEX "IDX_40460ab803bf6e5a62b75a35c5" ON "organization" ("profile_link") `);
		await queryRunner.query(`CREATE INDEX "IDX_6cc2b2052744e352834a4c9e78" ON "organization" ("banner") `);
		await queryRunner.query(`CREATE INDEX "IDX_b03a8a28f6ebdb6df8f630216b" ON "organization" ("totalEmployees") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f37d866c3326eca5f579cef35c" ON "organization" ("short_description") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c75285bf286b17c7ca5537857b" ON "organization" ("client_focus") `);
		await queryRunner.query(`CREATE INDEX "IDX_9ea70bf5c390b00e7bb96b86ed" ON "organization" ("overview") `);
		await queryRunner.query(`CREATE INDEX "IDX_15458cef74076623c270500053" ON "organization" ("currency") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2360aa7a4b5ab99e026584f305" ON "organization" ("defaultValueDateType") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_7965db2b12872551b586f76dd7" ON "organization" ("contactId") `);
		await queryRunner.query(`CREATE INDEX "IDX_47b6a97e09895a06606a4a8042" ON "organization" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9b171391d920c279fae8a1bf2" ON "organization" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_636b2ccafeee793bb7edc5a591" ON "organization" ("deletedByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_dc605390f47dd26469f855307d"`);
		await queryRunner.query(`DROP INDEX "IDX_8966a6ed4ff080f259844c38b9"`);
		await queryRunner.query(`DROP INDEX "IDX_aed773ef44611150e65749733b"`);
		await queryRunner.query(`DROP INDEX "IDX_ba7262af6a2906c992fe8ca3fe"`);
		await queryRunner.query(`DROP INDEX "IDX_12a0a79f962a124f93c8796e4b"`);
		await queryRunner.query(`DROP INDEX "IDX_674bdff03d51898ca8a237f163"`);
		await queryRunner.query(`DROP INDEX "IDX_228e69500a55e2f311c0219d9f"`);
		await queryRunner.query(`DROP INDEX "IDX_d79d3bd6115187d2e73ea8b3ff"`);
		await queryRunner.query(`DROP INDEX "IDX_382c80e92aa263e9cd2e98a664"`);
		await queryRunner.query(`DROP INDEX "IDX_f955d4fc2146d3696c9af8f068"`);
		await queryRunner.query(`DROP INDEX "IDX_f120aba634b63389a3a351a4f5"`);
		await queryRunner.query(`DROP INDEX "IDX_63d9e137716eb1bdfe93ccf23d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_time_slot_session" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sessionId" varchar NOT NULL, "startTime" datetime, "lastActivity" datetime, "timeSlotId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_63d9e137716eb1bdfe93ccf23d2" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f120aba634b63389a3a351a4f57" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f955d4fc2146d3696c9af8f0688" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_228e69500a55e2f311c0219d9fc" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_674bdff03d51898ca8a237f1630" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8966a6ed4ff080f259844c38b9d" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dc605390f47dd26469f855307dc" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_time_slot_session"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "sessionId", "startTime", "lastActivity", "timeSlotId", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "sessionId", "startTime", "lastActivity", "timeSlotId", "employeeId" FROM "time_slot_session"`
		);
		await queryRunner.query(`DROP TABLE "time_slot_session"`);
		await queryRunner.query(`ALTER TABLE "temporary_time_slot_session" RENAME TO "time_slot_session"`);
		await queryRunner.query(`CREATE INDEX "IDX_dc605390f47dd26469f855307d" ON "time_slot_session" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8966a6ed4ff080f259844c38b9" ON "time_slot_session" ("timeSlotId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_aed773ef44611150e65749733b" ON "time_slot_session" ("lastActivity") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ba7262af6a2906c992fe8ca3fe" ON "time_slot_session" ("startTime") `);
		await queryRunner.query(`CREATE INDEX "IDX_12a0a79f962a124f93c8796e4b" ON "time_slot_session" ("sessionId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_674bdff03d51898ca8a237f163" ON "time_slot_session" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_228e69500a55e2f311c0219d9f" ON "time_slot_session" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d79d3bd6115187d2e73ea8b3ff" ON "time_slot_session" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_382c80e92aa263e9cd2e98a664" ON "time_slot_session" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f955d4fc2146d3696c9af8f068" ON "time_slot_session" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f120aba634b63389a3a351a4f5" ON "time_slot_session" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_63d9e137716eb1bdfe93ccf23d" ON "time_slot_session" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_f209a8620f1677ed2c82c4cd2e"`);
		await queryRunner.query(`DROP INDEX "IDX_0b5cc71673410a449491fb3db9"`);
		await queryRunner.query(`DROP INDEX "IDX_06f10073cd6e84a19b6f604ddd"`);
		await queryRunner.query(`DROP INDEX "IDX_cf185e176c869e2be48d00d648"`);
		await queryRunner.query(`DROP INDEX "IDX_0ed7c977facb534e572d33b485"`);
		await queryRunner.query(`DROP INDEX "IDX_5df2b63d82f2168e43c2d7e64c"`);
		await queryRunner.query(`DROP INDEX "IDX_545faee53386f4e9d7b4311104"`);
		await queryRunner.query(`DROP INDEX "IDX_c47db2e2072ba3b57060819246"`);
		await queryRunner.query(`DROP INDEX "IDX_6d6a338f4eb5b467c2ff5eaa4b"`);
		await queryRunner.query(`DROP INDEX "IDX_e723cb5fdc4092538fe0384853"`);
		await queryRunner.query(`DROP INDEX "IDX_c4accce384c6007c92b9afdc2d"`);
		await queryRunner.query(`DROP INDEX "IDX_1aca41d7ee08b3b140eae4ee88"`);
		await queryRunner.query(`DROP INDEX "IDX_a32259b1b9cdeea1c6d94bf94c"`);
		await queryRunner.query(`DROP INDEX "IDX_52ca2ab9f943fe3f47df36aef7"`);
		await queryRunner.query(`DROP INDEX "IDX_4f1dada611375594ce22411cbe"`);
		await queryRunner.query(`DROP INDEX "IDX_69f72957e1c98832cdab0c486e"`);
		await queryRunner.query(`DROP INDEX "IDX_a3a616a07b21a4212736493f5e"`);
		await queryRunner.query(`DROP INDEX "IDX_1394aebfcfe6782051e76f46a5"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_tenants" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar NOT NULL, "enabled" boolean NOT NULL DEFAULT (1), "scope" varchar CHECK( "scope" IN ('tenant','organization','user') ) NOT NULL DEFAULT ('user'), "autoInstall" boolean NOT NULL DEFAULT (0), "requiresApproval" boolean NOT NULL DEFAULT (1), "isMandatory" boolean NOT NULL DEFAULT (0), "maxInstallations" integer, "maxActiveUsers" integer, "currentInstallations" integer NOT NULL DEFAULT (0), "currentActiveUsers" integer NOT NULL DEFAULT (0), "tenantConfiguration" text, "preferences" text, "approvedAt" text, "isDataCompliant" boolean NOT NULL DEFAULT (1), "complianceCertifications" text, "approvedById" varchar, CONSTRAINT "FK_f209a8620f1677ed2c82c4cd2e4" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0b5cc71673410a449491fb3db93" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_06f10073cd6e84a19b6f604ddd1" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5df2b63d82f2168e43c2d7e64c1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_545faee53386f4e9d7b43111047" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_c47db2e2072ba3b570608192467" FOREIGN KEY ("pluginId") REFERENCES "plugins" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_52ca2ab9f943fe3f47df36aef76" FOREIGN KEY ("approvedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_tenants"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "enabled", "scope", "autoInstall", "requiresApproval", "isMandatory", "maxInstallations", "maxActiveUsers", "currentInstallations", "currentActiveUsers", "tenantConfiguration", "preferences", "approvedAt", "isDataCompliant", "complianceCertifications", "approvedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "enabled", "scope", "autoInstall", "requiresApproval", "isMandatory", "maxInstallations", "maxActiveUsers", "currentInstallations", "currentActiveUsers", "tenantConfiguration", "preferences", "approvedAt", "isDataCompliant", "complianceCertifications", "approvedById" FROM "plugin_tenants"`
		);
		await queryRunner.query(`DROP TABLE "plugin_tenants"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_tenants" RENAME TO "plugin_tenants"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_f209a8620f1677ed2c82c4cd2e" ON "plugin_tenants" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b5cc71673410a449491fb3db9" ON "plugin_tenants" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_06f10073cd6e84a19b6f604ddd" ON "plugin_tenants" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cf185e176c869e2be48d00d648" ON "plugin_tenants" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ed7c977facb534e572d33b485" ON "plugin_tenants" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_5df2b63d82f2168e43c2d7e64c" ON "plugin_tenants" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_545faee53386f4e9d7b4311104" ON "plugin_tenants" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c47db2e2072ba3b57060819246" ON "plugin_tenants" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d6a338f4eb5b467c2ff5eaa4b" ON "plugin_tenants" ("enabled") `);
		await queryRunner.query(`CREATE INDEX "IDX_e723cb5fdc4092538fe0384853" ON "plugin_tenants" ("scope") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4accce384c6007c92b9afdc2d" ON "plugin_tenants" ("currentInstallations") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1aca41d7ee08b3b140eae4ee88" ON "plugin_tenants" ("currentActiveUsers") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a32259b1b9cdeea1c6d94bf94c" ON "plugin_tenants" ("approvedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_52ca2ab9f943fe3f47df36aef7" ON "plugin_tenants" ("approvedById") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_4f1dada611375594ce22411cbe" ON "plugin_tenants" ("pluginId", "enabled") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_69f72957e1c98832cdab0c486e" ON "plugin_tenants" ("organizationId", "scope") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a3a616a07b21a4212736493f5e" ON "plugin_tenants" ("tenantId", "scope", "enabled") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1394aebfcfe6782051e76f46a5" ON "plugin_tenants" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_5534e36ff3a1416c17f507d546"`);
		await queryRunner.query(`DROP INDEX "IDX_6b8deef29d0fb5eee571c39b39"`);
		await queryRunner.query(`DROP INDEX "IDX_a97ab238dc6aff5f305d37dbc7"`);
		await queryRunner.query(`DROP INDEX "IDX_cf20745f234b0b3512c03d74be"`);
		await queryRunner.query(`DROP INDEX "IDX_199b3708ea7962d21fc55de243"`);
		await queryRunner.query(`DROP INDEX "IDX_bbced9536ca0a8ee967b531c32"`);
		await queryRunner.query(`DROP INDEX "IDX_d4504369b0f19d2360a464408a"`);
		await queryRunner.query(`DROP INDEX "IDX_737e0935140d7b17632fc7815a"`);
		await queryRunner.query(`DROP INDEX "IDX_8e11188fb92db2ee126b53e866"`);
		await queryRunner.query(`DROP INDEX "IDX_a8471a91f63494a0d3ec5cf248"`);
		await queryRunner.query(`DROP INDEX "IDX_734649a34ee071f44de4a14490"`);
		await queryRunner.query(`DROP INDEX "IDX_48aa394150a960cf3e7b285cf4"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_settings" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "key" varchar NOT NULL, "value" text NOT NULL, "isRequired" boolean NOT NULL DEFAULT (0), "isEncrypted" boolean NOT NULL DEFAULT (0), "description" text, "order" integer, "validationRules" text, "dataType" varchar CHECK( "dataType" IN ('string','number','boolean','json','file') ) NOT NULL DEFAULT ('string'), "defaultValue" varchar, "pluginId" varchar NOT NULL, "pluginTenantId" varchar, "categoryId" varchar, "updatedById" varchar, CONSTRAINT "FK_5534e36ff3a1416c17f507d5469" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6b8deef29d0fb5eee571c39b39b" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a97ab238dc6aff5f305d37dbc72" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_bbced9536ca0a8ee967b531c325" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d4504369b0f19d2360a464408ad" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_737e0935140d7b17632fc7815ad" FOREIGN KEY ("pluginId") REFERENCES "plugins" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8e11188fb92db2ee126b53e866e" FOREIGN KEY ("pluginTenantId") REFERENCES "plugin_tenants" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a8471a91f63494a0d3ec5cf248c" FOREIGN KEY ("categoryId") REFERENCES "plugin_categories" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_734649a34ee071f44de4a14490d" FOREIGN KEY ("updatedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_settings"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "key", "value", "isRequired", "isEncrypted", "description", "order", "validationRules", "dataType", "defaultValue", "pluginId", "pluginTenantId", "categoryId", "updatedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "key", "value", "isRequired", "isEncrypted", "description", "order", "validationRules", "dataType", "defaultValue", "pluginId", "pluginTenantId", "categoryId", "updatedById" FROM "plugin_settings"`
		);
		await queryRunner.query(`DROP TABLE "plugin_settings"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_settings" RENAME TO "plugin_settings"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_5534e36ff3a1416c17f507d546" ON "plugin_settings" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b8deef29d0fb5eee571c39b39" ON "plugin_settings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a97ab238dc6aff5f305d37dbc7" ON "plugin_settings" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cf20745f234b0b3512c03d74be" ON "plugin_settings" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_199b3708ea7962d21fc55de243" ON "plugin_settings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_bbced9536ca0a8ee967b531c32" ON "plugin_settings" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d4504369b0f19d2360a464408a" ON "plugin_settings" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_737e0935140d7b17632fc7815a" ON "plugin_settings" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8e11188fb92db2ee126b53e866" ON "plugin_settings" ("pluginTenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a8471a91f63494a0d3ec5cf248" ON "plugin_settings" ("categoryId") `);
		await queryRunner.query(`CREATE INDEX "IDX_734649a34ee071f44de4a14490" ON "plugin_settings" ("updatedById") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_48aa394150a960cf3e7b285cf4" ON "plugin_settings" ("pluginId", "key", "pluginTenantId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_60543808734ff13850d7843f7b"`);
		await queryRunner.query(`DROP INDEX "IDX_c7c4b6b97be418be173859d10d"`);
		await queryRunner.query(`DROP INDEX "IDX_1fa4520b20a0bf4fdfe3ca1ec7"`);
		await queryRunner.query(`DROP INDEX "IDX_99ab190a6b7ae5ffc61b4dfaf4"`);
		await queryRunner.query(`DROP INDEX "IDX_b23665ef0d73dbe47d4d26f3d5"`);
		await queryRunner.query(`DROP INDEX "IDX_7c239f665e5caedd708c62b1f7"`);
		await queryRunner.query(`DROP INDEX "IDX_ca31918911db08a4008be72c8e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_categories" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "slug" varchar NOT NULL, "color" varchar, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "metadata" text, "parentId" varchar, CONSTRAINT "UQ_d427c34c4dd721c72d5d56187f9" UNIQUE ("slug"), CONSTRAINT "FK_60543808734ff13850d7843f7b8" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c7c4b6b97be418be173859d10da" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1fa4520b20a0bf4fdfe3ca1ec7b" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7c239f665e5caedd708c62b1f7a" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ca31918911db08a4008be72c8e5" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_70bfaf5965c91621dedb183bc81" FOREIGN KEY ("parentId") REFERENCES "plugin_categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_categories"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "slug", "color", "icon", "order", "metadata", "parentId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "slug", "color", "icon", "order", "metadata", "parentId" FROM "plugin_categories"`
		);
		await queryRunner.query(`DROP TABLE "plugin_categories"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_categories" RENAME TO "plugin_categories"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_60543808734ff13850d7843f7b" ON "plugin_categories" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4b6b97be418be173859d10d" ON "plugin_categories" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1fa4520b20a0bf4fdfe3ca1ec7" ON "plugin_categories" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_99ab190a6b7ae5ffc61b4dfaf4" ON "plugin_categories" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b23665ef0d73dbe47d4d26f3d5" ON "plugin_categories" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7c239f665e5caedd708c62b1f7" ON "plugin_categories" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca31918911db08a4008be72c8e" ON "plugin_categories" ("organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_9b013a85a6ae26db17101ffb89"`);
		await queryRunner.query(`DROP INDEX "IDX_ee480ffb800fb2c9f6d91f66aa"`);
		await queryRunner.query(`DROP INDEX "IDX_09654ebaec00e0c0c4dfae4c42"`);
		await queryRunner.query(`DROP INDEX "IDX_fe4db46e2c3d32f64b4a4728e3"`);
		await queryRunner.query(`DROP INDEX "IDX_cacbb5fd767b06985be6049858"`);
		await queryRunner.query(`DROP INDEX "IDX_da359f059e06030ec33adba133"`);
		await queryRunner.query(`DROP INDEX "IDX_8bcd0243b780191a391b348f58"`);
		await queryRunner.query(`DROP INDEX "IDX_05292c8750270ff028ab2fec14"`);
		await queryRunner.query(`DROP INDEX "IDX_df3d0fc648c9e0544ca11df9d2"`);
		await queryRunner.query(`DROP INDEX "IDX_17c923b300710a13f6dfade59b"`);
		await queryRunner.query(`DROP INDEX "IDX_cddb5e04a93a957dc4d56522b7"`);
		await queryRunner.query(`DROP INDEX "IDX_676e7c749905331c36b1707ba8"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_tags" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar NOT NULL, "tagId" varchar NOT NULL, "appliedAt" text DEFAULT (CURRENT_TIMESTAMP), "appliedById" varchar, "priority" integer DEFAULT (50), "isFeatured" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_9b013a85a6ae26db17101ffb894" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ee480ffb800fb2c9f6d91f66aa7" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_09654ebaec00e0c0c4dfae4c427" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_da359f059e06030ec33adba1335" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8bcd0243b780191a391b348f582" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_05292c8750270ff028ab2fec140" FOREIGN KEY ("pluginId") REFERENCES "plugins" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_df3d0fc648c9e0544ca11df9d2e" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_tags"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "tagId", "appliedAt", "appliedById", "priority", "isFeatured") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "tagId", "appliedAt", "appliedById", "priority", "isFeatured" FROM "plugin_tags"`
		);
		await queryRunner.query(`DROP TABLE "plugin_tags"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_tags" RENAME TO "plugin_tags"`);
		await queryRunner.query(`CREATE INDEX "IDX_9b013a85a6ae26db17101ffb89" ON "plugin_tags" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee480ffb800fb2c9f6d91f66aa" ON "plugin_tags" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_09654ebaec00e0c0c4dfae4c42" ON "plugin_tags" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_fe4db46e2c3d32f64b4a4728e3" ON "plugin_tags" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_cacbb5fd767b06985be6049858" ON "plugin_tags" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_da359f059e06030ec33adba133" ON "plugin_tags" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8bcd0243b780191a391b348f58" ON "plugin_tags" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_05292c8750270ff028ab2fec14" ON "plugin_tags" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_df3d0fc648c9e0544ca11df9d2" ON "plugin_tags" ("tagId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_17c923b300710a13f6dfade59b" ON "plugin_tags" ("tagId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cddb5e04a93a957dc4d56522b7" ON "plugin_tags" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_676e7c749905331c36b1707ba8" ON "plugin_tags" ("pluginId", "tagId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_842e5e5f94c4008a42d4b5f44a"`);
		await queryRunner.query(`DROP INDEX "IDX_7e9b8b3eebb881753e07b73f6c"`);
		await queryRunner.query(`DROP INDEX "IDX_a45f5c2aba22d4fa4eb8fa85af"`);
		await queryRunner.query(`DROP INDEX "IDX_d742ed346264f4c9d9225265d7"`);
		await queryRunner.query(`DROP INDEX "IDX_3e63eed07bcc0e3e36d9183cca"`);
		await queryRunner.query(`DROP INDEX "IDX_dff9e6c763c8c33b07f330e6a1"`);
		await queryRunner.query(`DROP INDEX "IDX_8aafffefdce2eb11079ec2aa75"`);
		await queryRunner.query(`DROP INDEX "IDX_547e4b71ae81ee772fa4ab79e6"`);
		await queryRunner.query(`DROP INDEX "IDX_acac58b213936ea488d0a8d1a3"`);
		await queryRunner.query(`DROP INDEX "IDX_32c3f7a738ec8b40d6375b2933"`);
		await queryRunner.query(`DROP INDEX "IDX_28624735b4e3ace75883521a57"`);
		await queryRunner.query(`DROP INDEX "IDX_c92ea21dfcfd889730e2214c8f"`);
		await queryRunner.query(`DROP INDEX "IDX_5e6b80341a4ed75ae7c4af6897"`);
		await queryRunner.query(`DROP INDEX "IDX_3c3ce338e7716d853220d8b176"`);
		await queryRunner.query(`DROP INDEX "IDX_173e0668b17afd3696abf3c518"`);
		await queryRunner.query(`DROP INDEX "IDX_1569d8ca526d958d82483e15c7"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_installations" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar(36), "versionId" varchar(36), "installedById" varchar(36), "installedAt" datetime, "uninstalledAt" datetime, "status" varchar CHECK( "status" IN ('INSTALLED','UNINSTALLED','FAILED','IN_PROGRESS') ) NOT NULL DEFAULT ('IN_PROGRESS'), "isActivated" boolean NOT NULL DEFAULT (0), "activatedAt" datetime, "deactivatedAt" datetime, CONSTRAINT "FK_842e5e5f94c4008a42d4b5f44a6" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7e9b8b3eebb881753e07b73f6c6" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a45f5c2aba22d4fa4eb8fa85af8" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dff9e6c763c8c33b07f330e6a19" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8aafffefdce2eb11079ec2aa755" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_547e4b71ae81ee772fa4ab79e60" FOREIGN KEY ("pluginId") REFERENCES "plugins" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_acac58b213936ea488d0a8d1a30" FOREIGN KEY ("versionId") REFERENCES "plugin_versions" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_32c3f7a738ec8b40d6375b2933c" FOREIGN KEY ("installedById") REFERENCES "employee" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_installations"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status", "isActivated", "activatedAt", "deactivatedAt") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status", "isActivated", "activatedAt", "deactivatedAt" FROM "plugin_installations"`
		);
		await queryRunner.query(`DROP TABLE "plugin_installations"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_installations" RENAME TO "plugin_installations"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_842e5e5f94c4008a42d4b5f44a" ON "plugin_installations" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7e9b8b3eebb881753e07b73f6c" ON "plugin_installations" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a45f5c2aba22d4fa4eb8fa85af" ON "plugin_installations" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d742ed346264f4c9d9225265d7" ON "plugin_installations" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3e63eed07bcc0e3e36d9183cca" ON "plugin_installations" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dff9e6c763c8c33b07f330e6a1" ON "plugin_installations" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aafffefdce2eb11079ec2aa75" ON "plugin_installations" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_547e4b71ae81ee772fa4ab79e6" ON "plugin_installations" ("pluginId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_acac58b213936ea488d0a8d1a3" ON "plugin_installations" ("versionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_32c3f7a738ec8b40d6375b2933" ON "plugin_installations" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_28624735b4e3ace75883521a57" ON "plugin_installations" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c92ea21dfcfd889730e2214c8f" ON "plugin_installations" ("uninstalledAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e6b80341a4ed75ae7c4af6897" ON "plugin_installations" ("activatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3c3ce338e7716d853220d8b176" ON "plugin_installations" ("deactivatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_173e0668b17afd3696abf3c518" ON "plugin_installations" ("installedById", "pluginId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1569d8ca526d958d82483e15c7" ON "plugin_installations" ("pluginId", "tenantId", "organizationId", "installedById") `
		);
		await queryRunner.query(`DROP INDEX "IDX_09a383d6f2858d49c064ca4cda"`);
		await queryRunner.query(`DROP INDEX "IDX_0404416b5c1cd48ae87fe81834"`);
		await queryRunner.query(`DROP INDEX "IDX_c90b796bd033e54e3719213a0c"`);
		await queryRunner.query(`DROP INDEX "IDX_cb9a1e5640b8e07a9a63b51245"`);
		await queryRunner.query(`DROP INDEX "IDX_0ab83b39cc676ee2097714fb3b"`);
		await queryRunner.query(`DROP INDEX "IDX_19d9135639e3b40ec0dca1c926"`);
		await queryRunner.query(`DROP INDEX "IDX_7c6dc1cdd58690b7179d76184b"`);
		await queryRunner.query(`DROP INDEX "IDX_55bee446d2c470e5d6b066a27a"`);
		await queryRunner.query(`DROP INDEX "IDX_d658bc853b354445cf2a0d6fb7"`);
		await queryRunner.query(`DROP INDEX "IDX_af8978fbf37560525c19ec7048"`);
		await queryRunner.query(`DROP INDEX "IDX_6fae6d0ddfd7177abcb4befd72"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_sources" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "operatingSystem" varchar CHECK( "operatingSystem" IN ('LINUX','MAC','WINDOWS','UNIVERSAL') ) NOT NULL DEFAULT ('UNIVERSAL'), "architecture" varchar CHECK( "architecture" IN ('X64','ARM') ) NOT NULL DEFAULT ('X64'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "private" boolean DEFAULT (0), "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "versionId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ), CONSTRAINT "FK_09a383d6f2858d49c064ca4cda9" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0404416b5c1cd48ae87fe81834a" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c90b796bd033e54e3719213a0ce" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_19d9135639e3b40ec0dca1c9261" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7c6dc1cdd58690b7179d76184be" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_55bee446d2c470e5d6b066a27a2" FOREIGN KEY ("versionId") REFERENCES "plugin_versions" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_sources"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "operatingSystem", "architecture", "url", "integrity", "crossOrigin", "name", "registry", "private", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "versionId", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "operatingSystem", "architecture", "url", "integrity", "crossOrigin", "name", "registry", "private", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "versionId", "storageProvider" FROM "plugin_sources"`
		);
		await queryRunner.query(`DROP TABLE "plugin_sources"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_sources" RENAME TO "plugin_sources"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_09a383d6f2858d49c064ca4cda" ON "plugin_sources" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0404416b5c1cd48ae87fe81834" ON "plugin_sources" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c90b796bd033e54e3719213a0c" ON "plugin_sources" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_cb9a1e5640b8e07a9a63b51245" ON "plugin_sources" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ab83b39cc676ee2097714fb3b" ON "plugin_sources" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_19d9135639e3b40ec0dca1c926" ON "plugin_sources" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7c6dc1cdd58690b7179d76184b" ON "plugin_sources" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_55bee446d2c470e5d6b066a27a" ON "plugin_sources" ("versionId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d658bc853b354445cf2a0d6fb7" ON "plugin_sources" ("storageProvider") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af8978fbf37560525c19ec7048" ON "plugin_sources" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6fae6d0ddfd7177abcb4befd72" ON "plugin_sources" ("versionId", "operatingSystem", "architecture", "tenantId", "organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_485db4d1cc977cc3d499824d95"`);
		await queryRunner.query(`DROP INDEX "IDX_0b36b5701e9890a395ded76cb5"`);
		await queryRunner.query(`DROP INDEX "IDX_e06094816e67e584dea754cc81"`);
		await queryRunner.query(`DROP INDEX "IDX_e6d49799b916946e5cd5399385"`);
		await queryRunner.query(`DROP INDEX "IDX_a16869769b9a219acb157bb2b3"`);
		await queryRunner.query(`DROP INDEX "IDX_650ccf2e7394509f7ad8448e32"`);
		await queryRunner.query(`DROP INDEX "IDX_f806bae81cd490404a1888ad5b"`);
		await queryRunner.query(`DROP INDEX "IDX_ab6e29cd444226f80bf0c0c1db"`);
		await queryRunner.query(`DROP INDEX "IDX_8adf7a9181e968bcafc71236c8"`);
		await queryRunner.query(`DROP INDEX "IDX_6fa0eda3add1fb070ba172a44e"`);
		await queryRunner.query(`DROP INDEX "IDX_e632aa70ea7b7e5c5fdbfba41b"`);
		await queryRunner.query(`DROP INDEX "IDX_e1e7cf1589d06ac02a12e41db0"`);
		await queryRunner.query(`DROP INDEX "IDX_f5c8259c0d815486f31878864d"`);
		await queryRunner.query(`DROP INDEX "IDX_39d060301c8a36b51da6e4aec3"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_versions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar, CONSTRAINT "FK_485db4d1cc977cc3d499824d958" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0b36b5701e9890a395ded76cb57" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e06094816e67e584dea754cc81c" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_650ccf2e7394509f7ad8448e323" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f806bae81cd490404a1888ad5b9" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8adf7a9181e968bcafc71236c80" FOREIGN KEY ("pluginId") REFERENCES "plugins" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_versions"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId" FROM "plugin_versions"`
		);
		await queryRunner.query(`DROP TABLE "plugin_versions"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_versions" RENAME TO "plugin_versions"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_485db4d1cc977cc3d499824d95" ON "plugin_versions" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b36b5701e9890a395ded76cb5" ON "plugin_versions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e06094816e67e584dea754cc81" ON "plugin_versions" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e6d49799b916946e5cd5399385" ON "plugin_versions" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_a16869769b9a219acb157bb2b3" ON "plugin_versions" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_650ccf2e7394509f7ad8448e32" ON "plugin_versions" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f806bae81cd490404a1888ad5b" ON "plugin_versions" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_ab6e29cd444226f80bf0c0c1db" ON "plugin_versions" ("releaseDate") `);
		await queryRunner.query(`CREATE INDEX "IDX_8adf7a9181e968bcafc71236c8" ON "plugin_versions" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fa0eda3add1fb070ba172a44e" ON "plugin_versions" ("downloadCount") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e632aa70ea7b7e5c5fdbfba41b" ON "plugin_versions" ("number") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e1e7cf1589d06ac02a12e41db0" ON "plugin_versions" ("pluginId", "releaseDate") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f5c8259c0d815486f31878864d" ON "plugin_versions" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_39d060301c8a36b51da6e4aec3" ON "plugin_versions" ("pluginId", "organizationId", "number") `
		);
		await queryRunner.query(`DROP INDEX "IDX_cc5b64091fbfdcdbd23d6da80e"`);
		await queryRunner.query(`DROP INDEX "IDX_61357761fc6b140180b104dc8d"`);
		await queryRunner.query(`DROP INDEX "IDX_3210c015451d02d015a23eedad"`);
		await queryRunner.query(`DROP INDEX "IDX_d0a1444aa92229d7f1af237184"`);
		await queryRunner.query(`DROP INDEX "IDX_c61c7032e7b3afd352d82bc4b4"`);
		await queryRunner.query(`DROP INDEX "IDX_35ee1cb5098e17e30ee5cbc705"`);
		await queryRunner.query(`DROP INDEX "IDX_100eef6409ee96d0673ee510e6"`);
		await queryRunner.query(`DROP INDEX "IDX_16d0aed6fcc311379f5c75bbd2"`);
		await queryRunner.query(`DROP INDEX "IDX_4bf89f98c41969e23e3f9974d5"`);
		await queryRunner.query(`DROP INDEX "IDX_15ca158f27ab3296915b7d1b38"`);
		await queryRunner.query(`DROP INDEX "IDX_123f1b37f4826f6241446a8416"`);
		await queryRunner.query(`DROP INDEX "IDX_c0fab3c6709a93bca88eb100a9"`);
		await queryRunner.query(`DROP INDEX "IDX_6c8d4a0f437cfae296ef43ce13"`);
		await queryRunner.query(`DROP INDEX "IDX_0479844f05c1132f8929cab1c8"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugins" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "name" varchar NOT NULL, "description" varchar, "type" varchar CHECK( "type" IN ('DESKTOP','WEB','MOBILE') ) NOT NULL DEFAULT ('DESKTOP'), "status" varchar CHECK( "status" IN ('ACTIVE','INACTIVE','DEPRECATED','ARCHIVED') ) NOT NULL DEFAULT ('ACTIVE'), "categoryId" varchar, "author" varchar, "license" varchar, "homepage" varchar, "repository" varchar, "uploadedById" varchar, "uploadedAt" datetime, "requiresSubscription" boolean NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "isVerified" boolean NOT NULL DEFAULT (0), "lastDownloadedAt" datetime, CONSTRAINT "FK_cc5b64091fbfdcdbd23d6da80ee" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_61357761fc6b140180b104dc8d5" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3210c015451d02d015a23eedad4" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16d0aed6fcc311379f5c75bbd2d" FOREIGN KEY ("categoryId") REFERENCES "plugin_categories" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4bf89f98c41969e23e3f9974d56" FOREIGN KEY ("uploadedById") REFERENCES "user" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugins"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "status", "categoryId", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "requiresSubscription", "isFeatured", "isVerified", "lastDownloadedAt") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "status", "categoryId", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "requiresSubscription", "isFeatured", "isVerified", "lastDownloadedAt" FROM "plugins"`
		);
		await queryRunner.query(`DROP TABLE "plugins"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugins" RENAME TO "plugins"`);
		await queryRunner.query(`CREATE INDEX "IDX_cc5b64091fbfdcdbd23d6da80e" ON "plugins" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_61357761fc6b140180b104dc8d" ON "plugins" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3210c015451d02d015a23eedad" ON "plugins" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d0a1444aa92229d7f1af237184" ON "plugins" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c61c7032e7b3afd352d82bc4b4" ON "plugins" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_35ee1cb5098e17e30ee5cbc705" ON "plugins" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_100eef6409ee96d0673ee510e6" ON "plugins" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_16d0aed6fcc311379f5c75bbd2" ON "plugins" ("categoryId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4bf89f98c41969e23e3f9974d5" ON "plugins" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_15ca158f27ab3296915b7d1b38" ON "plugins" ("isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_123f1b37f4826f6241446a8416" ON "plugins" ("isVerified") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0fab3c6709a93bca88eb100a9" ON "plugins" ("status", "isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_6c8d4a0f437cfae296ef43ce13" ON "plugins" ("status", "type") `);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0479844f05c1132f8929cab1c8" ON "plugins" ("name") `);
		await queryRunner.query(`DROP INDEX "IDX_646aa1161ac9861061842e05c2"`);
		await queryRunner.query(`DROP INDEX "IDX_b874f9ee9c04061b4892926388"`);
		await queryRunner.query(`DROP INDEX "IDX_6f401b811d14d8b06db0fbea30"`);
		await queryRunner.query(`DROP INDEX "IDX_a7bf8b446ca66e5824fb6ff91a"`);
		await queryRunner.query(`DROP INDEX "IDX_dec9037a57726ae5f54bc3c4a8"`);
		await queryRunner.query(`DROP INDEX "IDX_234c8f3d694ae31b095bdf5a8a"`);
		await queryRunner.query(`DROP INDEX "IDX_37c9e1c698331b9345280374fd"`);
		await queryRunner.query(`DROP INDEX "IDX_082f6cba880ecd144b28284376"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_subscription_plans" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "name" varchar NOT NULL, "description" text, "type" varchar CHECK( "type" IN ('free','trial','basic','premium','enterprise','custom') ) NOT NULL DEFAULT ('free'), "price" decimal(10,2) NOT NULL DEFAULT (0), "currency" varchar(3) NOT NULL DEFAULT ('USD'), "billingPeriod" varchar CHECK( "billingPeriod" IN ('daily','weekly','monthly','quarterly','yearly','one-time') ) NOT NULL DEFAULT ('monthly'), "features" text NOT NULL, "limitations" text, "isPopular" boolean NOT NULL DEFAULT (0), "isRecommended" boolean NOT NULL DEFAULT (0), "trialDays" integer, "setupFee" decimal(10,2), "discountPercentage" decimal(5,2), "metadata" text, "sortOrder" integer NOT NULL DEFAULT (0), "pluginId" varchar NOT NULL, "createdById" varchar, CONSTRAINT "FK_646aa1161ac9861061842e05c2f" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b874f9ee9c04061b4892926388f" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6f401b811d14d8b06db0fbea308" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a06a8b0e7f54e73cfc92c96511b" FOREIGN KEY ("pluginId") REFERENCES "plugins" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d3afff45d3c259d2d484387a248" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_subscription_plans"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "price", "currency", "billingPeriod", "features", "limitations", "isPopular", "isRecommended", "trialDays", "setupFee", "discountPercentage", "metadata", "sortOrder", "pluginId", "createdById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "price", "currency", "billingPeriod", "features", "limitations", "isPopular", "isRecommended", "trialDays", "setupFee", "discountPercentage", "metadata", "sortOrder", "pluginId", "createdById" FROM "plugin_subscription_plans"`
		);
		await queryRunner.query(`DROP TABLE "plugin_subscription_plans"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_plugin_subscription_plans" RENAME TO "plugin_subscription_plans"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_646aa1161ac9861061842e05c2" ON "plugin_subscription_plans" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b874f9ee9c04061b4892926388" ON "plugin_subscription_plans" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f401b811d14d8b06db0fbea30" ON "plugin_subscription_plans" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7bf8b446ca66e5824fb6ff91a" ON "plugin_subscription_plans" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dec9037a57726ae5f54bc3c4a8" ON "plugin_subscription_plans" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_234c8f3d694ae31b095bdf5a8a" ON "plugin_subscription_plans" ("price", "billingPeriod") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_37c9e1c698331b9345280374fd" ON "plugin_subscription_plans" ("isActive", "type") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_082f6cba880ecd144b28284376" ON "plugin_subscription_plans" ("pluginId", "type") `
		);
		await queryRunner.query(`DROP INDEX "IDX_449b2294593f5787f40a60c8f2"`);
		await queryRunner.query(`DROP INDEX "IDX_ddf7be116060ee20bc16128632"`);
		await queryRunner.query(`DROP INDEX "IDX_0be98c36cdbaa56f3880bc6baa"`);
		await queryRunner.query(`DROP INDEX "IDX_18743cb5933b78e2b8081589e4"`);
		await queryRunner.query(`DROP INDEX "IDX_b5163f874ce5bc6b63c8e8631a"`);
		await queryRunner.query(`DROP INDEX "IDX_7f792e3c1891f728f9e5256142"`);
		await queryRunner.query(`DROP INDEX "IDX_9bbac226cce476576134c5726e"`);
		await queryRunner.query(`DROP INDEX "IDX_7afeffe18364cae48efd454e4d"`);
		await queryRunner.query(`DROP INDEX "IDX_39a16aca760fc7a3cef39d5563"`);
		await queryRunner.query(`DROP INDEX "IDX_bbd6dc08c0c91724e5d26202fa"`);
		await queryRunner.query(`DROP INDEX "IDX_4e8a9f4ee7df8c39d0314063e7"`);
		await queryRunner.query(`DROP INDEX "IDX_18db53b62833e1bdb9949b5827"`);
		await queryRunner.query(`DROP INDEX "IDX_448990d16086477ee1c5f08968"`);
		await queryRunner.query(`DROP INDEX "IDX_fed0c61e1d142e1c448a45e5a0"`);
		await queryRunner.query(`DROP INDEX "IDX_af82eaa17a59e0cf0fac16d7fe"`);
		await queryRunner.query(`DROP INDEX "IDX_eb3b9c7cfe7aa86bca589aee9e"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_subscriptions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar CHECK( "status" IN ('active','cancelled','expired','trial','past_due','suspended','pending') ) NOT NULL DEFAULT ('pending'), "scope" varchar CHECK( "scope" IN ('tenant','organization','user') ) NOT NULL DEFAULT ('tenant'), "startDate" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "endDate" datetime, "trialEndDate" datetime, "autoRenew" boolean NOT NULL DEFAULT (1), "cancelledAt" datetime, "cancellationReason" text, "metadata" text, "externalSubscriptionId" varchar, "pluginId" varchar NOT NULL, "pluginTenantId" varchar NOT NULL, "planId" varchar, "subscriberId" varchar, "parentId" varchar, CONSTRAINT "FK_449b2294593f5787f40a60c8f23" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ddf7be116060ee20bc16128632d" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_0be98c36cdbaa56f3880bc6baa5" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7f792e3c1891f728f9e52561428" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9bbac226cce476576134c5726e2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_052c95e24f8ac2afdea389d31e0" FOREIGN KEY ("pluginId") REFERENCES "plugins" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6163fac447615c15bdd3cc4b108" FOREIGN KEY ("pluginTenantId") REFERENCES "plugin_tenants" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4e8a9f4ee7df8c39d0314063e73" FOREIGN KEY ("planId") REFERENCES "plugin_subscription_plans" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b76c1241cbcbe8a92cba6d7fbcd" FOREIGN KEY ("subscriberId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_39a16aca760fc7a3cef39d55638" FOREIGN KEY ("parentId") REFERENCES "plugin_subscriptions" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_subscriptions"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "scope", "startDate", "endDate", "trialEndDate", "autoRenew", "cancelledAt", "cancellationReason", "metadata", "externalSubscriptionId", "pluginId", "pluginTenantId", "planId", "subscriberId", "parentId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "scope", "startDate", "endDate", "trialEndDate", "autoRenew", "cancelledAt", "cancellationReason", "metadata", "externalSubscriptionId", "pluginId", "pluginTenantId", "planId", "subscriberId", "parentId" FROM "plugin_subscriptions"`
		);
		await queryRunner.query(`DROP TABLE "plugin_subscriptions"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_subscriptions" RENAME TO "plugin_subscriptions"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_449b2294593f5787f40a60c8f2" ON "plugin_subscriptions" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ddf7be116060ee20bc16128632" ON "plugin_subscriptions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0be98c36cdbaa56f3880bc6baa" ON "plugin_subscriptions" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18743cb5933b78e2b8081589e4" ON "plugin_subscriptions" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b5163f874ce5bc6b63c8e8631a" ON "plugin_subscriptions" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7f792e3c1891f728f9e5256142" ON "plugin_subscriptions" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9bbac226cce476576134c5726e" ON "plugin_subscriptions" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7afeffe18364cae48efd454e4d" ON "plugin_subscriptions" ("scope", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_39a16aca760fc7a3cef39d5563" ON "plugin_subscriptions" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bbd6dc08c0c91724e5d26202fa" ON "plugin_subscriptions" ("externalSubscriptionId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_4e8a9f4ee7df8c39d0314063e7" ON "plugin_subscriptions" ("planId") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_18db53b62833e1bdb9949b5827" ON "plugin_subscriptions" ("pluginId", "subscriberId", "tenantId") WHERE "subscriberId" IS NOT NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_448990d16086477ee1c5f08968" ON "plugin_subscriptions" ("status", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fed0c61e1d142e1c448a45e5a0" ON "plugin_subscriptions" ("status", "endDate") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af82eaa17a59e0cf0fac16d7fe" ON "plugin_subscriptions" ("subscriberId", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb3b9c7cfe7aa86bca589aee9e" ON "plugin_subscriptions" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_74d0d8f22af90d92d3213d5e74"`);
		await queryRunner.query(`DROP INDEX "IDX_2c926e12d6fba9b0d320c974f3"`);
		await queryRunner.query(`DROP INDEX "IDX_8fb8bf376857199096a73d90b8"`);
		await queryRunner.query(`DROP INDEX "IDX_e1d678ee40f241203ee5ad7d41"`);
		await queryRunner.query(`DROP INDEX "IDX_9e3344b0c59fcd4cd699cef727"`);
		await queryRunner.query(`DROP INDEX "IDX_7b12d1d4e5d36737596155ce2d"`);
		await queryRunner.query(`DROP INDEX "IDX_7d05232ee38835a76623154b7b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_billings" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "amount" decimal(10,2) NOT NULL, "currency" varchar NOT NULL DEFAULT ('USD'), "billingDate" datetime NOT NULL, "dueDate" datetime NOT NULL, "status" varchar CHECK( "status" IN ('pending','processed','paid','overdue','failed','cancelled','refunded','partially_paid') ) NOT NULL DEFAULT ('pending'), "billingPeriod" varchar CHECK( "billingPeriod" IN ('daily','weekly','monthly','quarterly','yearly','one-time') ) NOT NULL, "billingPeriodStart" datetime NOT NULL, "billingPeriodEnd" datetime NOT NULL, "description" text, "metadata" text, "subscriptionId" varchar NOT NULL, CONSTRAINT "FK_74d0d8f22af90d92d3213d5e74e" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2c926e12d6fba9b0d320c974f32" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_8fb8bf376857199096a73d90b86" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7b12d1d4e5d36737596155ce2d5" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7d05232ee38835a76623154b7b2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_3c3212b2cf3a4e6cc6896657bb1" FOREIGN KEY ("subscriptionId") REFERENCES "plugin_subscriptions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_billings"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "amount", "currency", "billingDate", "dueDate", "status", "billingPeriod", "billingPeriodStart", "billingPeriodEnd", "description", "metadata", "subscriptionId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "amount", "currency", "billingDate", "dueDate", "status", "billingPeriod", "billingPeriodStart", "billingPeriodEnd", "description", "metadata", "subscriptionId" FROM "plugin_billings"`
		);
		await queryRunner.query(`DROP TABLE "plugin_billings"`);
		await queryRunner.query(`ALTER TABLE "temporary_plugin_billings" RENAME TO "plugin_billings"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_74d0d8f22af90d92d3213d5e74" ON "plugin_billings" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2c926e12d6fba9b0d320c974f3" ON "plugin_billings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8fb8bf376857199096a73d90b8" ON "plugin_billings" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e1d678ee40f241203ee5ad7d41" ON "plugin_billings" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9e3344b0c59fcd4cd699cef727" ON "plugin_billings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_7b12d1d4e5d36737596155ce2d" ON "plugin_billings" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d05232ee38835a76623154b7b" ON "plugin_billings" ("organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_12c6c6c88720dfb785a0e066bb"`);
		await queryRunner.query(`DROP INDEX "IDX_0c355caddd182f2e7099d35911"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_tenant_allowed_roles" ("pluginTenantsId" varchar NOT NULL, "roleId" varchar NOT NULL, CONSTRAINT "FK_12c6c6c88720dfb785a0e066bb6" FOREIGN KEY ("pluginTenantsId") REFERENCES "plugin_tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0c355caddd182f2e7099d359119" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("pluginTenantsId", "roleId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_tenant_allowed_roles"("pluginTenantsId", "roleId") SELECT "pluginTenantsId", "roleId" FROM "plugin_tenant_allowed_roles"`
		);
		await queryRunner.query(`DROP TABLE "plugin_tenant_allowed_roles"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_plugin_tenant_allowed_roles" RENAME TO "plugin_tenant_allowed_roles"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_12c6c6c88720dfb785a0e066bb" ON "plugin_tenant_allowed_roles" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0c355caddd182f2e7099d35911" ON "plugin_tenant_allowed_roles" ("roleId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_358b3ee7d6cac92234c829e384"`);
		await queryRunner.query(`DROP INDEX "IDX_99cab633947d311b29e5e3d9f1"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_tenant_allowed_users" ("pluginTenantsId" varchar NOT NULL, "userId" varchar NOT NULL, CONSTRAINT "FK_358b3ee7d6cac92234c829e3844" FOREIGN KEY ("pluginTenantsId") REFERENCES "plugin_tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_99cab633947d311b29e5e3d9f16" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_tenant_allowed_users"("pluginTenantsId", "userId") SELECT "pluginTenantsId", "userId" FROM "plugin_tenant_allowed_users"`
		);
		await queryRunner.query(`DROP TABLE "plugin_tenant_allowed_users"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_plugin_tenant_allowed_users" RENAME TO "plugin_tenant_allowed_users"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_358b3ee7d6cac92234c829e384" ON "plugin_tenant_allowed_users" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_99cab633947d311b29e5e3d9f1" ON "plugin_tenant_allowed_users" ("userId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_27e45daf821a522cf6c7b794bc"`);
		await queryRunner.query(`DROP INDEX "IDX_17fc7d5ec9f51d9716c79b50ae"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_tenant_denied_users" ("pluginTenantsId" varchar NOT NULL, "userId" varchar NOT NULL, CONSTRAINT "FK_27e45daf821a522cf6c7b794bce" FOREIGN KEY ("pluginTenantsId") REFERENCES "plugin_tenants" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_17fc7d5ec9f51d9716c79b50ae8" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_tenant_denied_users"("pluginTenantsId", "userId") SELECT "pluginTenantsId", "userId" FROM "plugin_tenant_denied_users"`
		);
		await queryRunner.query(`DROP TABLE "plugin_tenant_denied_users"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_plugin_tenant_denied_users" RENAME TO "plugin_tenant_denied_users"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27e45daf821a522cf6c7b794bc" ON "plugin_tenant_denied_users" ("pluginTenantsId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17fc7d5ec9f51d9716c79b50ae" ON "plugin_tenant_denied_users" ("userId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_6eca05af711ef729dbe99f9b63"`);
		await queryRunner.query(`DROP INDEX "IDX_ac6e3a024785d6cd7e1dc8a7d0"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_categories_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, CONSTRAINT "FK_6eca05af711ef729dbe99f9b634" FOREIGN KEY ("id_ancestor") REFERENCES "plugin_categories" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_ac6e3a024785d6cd7e1dc8a7d08" FOREIGN KEY ("id_descendant") REFERENCES "plugin_categories" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_categories_closure"("id_ancestor", "id_descendant") SELECT "id_ancestor", "id_descendant" FROM "plugin_categories_closure"`
		);
		await queryRunner.query(`DROP TABLE "plugin_categories_closure"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_plugin_categories_closure" RENAME TO "plugin_categories_closure"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6eca05af711ef729dbe99f9b63" ON "plugin_categories_closure" ("id_ancestor") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ac6e3a024785d6cd7e1dc8a7d0" ON "plugin_categories_closure" ("id_descendant") `
		);
		await queryRunner.query(`DROP INDEX "IDX_31cca01b2ea11308a44475563b"`);
		await queryRunner.query(`DROP INDEX "IDX_9c7a67d94dc7edfc580657a52d"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_plugin_subscriptions_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, CONSTRAINT "FK_31cca01b2ea11308a44475563b3" FOREIGN KEY ("id_ancestor") REFERENCES "plugin_subscriptions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9c7a67d94dc7edfc580657a52df" FOREIGN KEY ("id_descendant") REFERENCES "plugin_subscriptions" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_plugin_subscriptions_closure"("id_ancestor", "id_descendant") SELECT "id_ancestor", "id_descendant" FROM "plugin_subscriptions_closure"`
		);
		await queryRunner.query(`DROP TABLE "plugin_subscriptions_closure"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_plugin_subscriptions_closure" RENAME TO "plugin_subscriptions_closure"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_31cca01b2ea11308a44475563b" ON "plugin_subscriptions_closure" ("id_ancestor") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c7a67d94dc7edfc580657a52d" ON "plugin_subscriptions_closure" ("id_descendant") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_9c7a67d94dc7edfc580657a52d"`);
		await queryRunner.query(`DROP INDEX "IDX_31cca01b2ea11308a44475563b"`);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscriptions_closure" RENAME TO "temporary_plugin_subscriptions_closure"`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscriptions_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_subscriptions_closure"("id_ancestor", "id_descendant") SELECT "id_ancestor", "id_descendant" FROM "temporary_plugin_subscriptions_closure"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_subscriptions_closure"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9c7a67d94dc7edfc580657a52d" ON "plugin_subscriptions_closure" ("id_descendant") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_31cca01b2ea11308a44475563b" ON "plugin_subscriptions_closure" ("id_ancestor") `
		);
		await queryRunner.query(`DROP INDEX "IDX_ac6e3a024785d6cd7e1dc8a7d0"`);
		await queryRunner.query(`DROP INDEX "IDX_6eca05af711ef729dbe99f9b63"`);
		await queryRunner.query(
			`ALTER TABLE "plugin_categories_closure" RENAME TO "temporary_plugin_categories_closure"`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_categories_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_categories_closure"("id_ancestor", "id_descendant") SELECT "id_ancestor", "id_descendant" FROM "temporary_plugin_categories_closure"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_categories_closure"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ac6e3a024785d6cd7e1dc8a7d0" ON "plugin_categories_closure" ("id_descendant") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6eca05af711ef729dbe99f9b63" ON "plugin_categories_closure" ("id_ancestor") `
		);
		await queryRunner.query(`DROP INDEX "IDX_17fc7d5ec9f51d9716c79b50ae"`);
		await queryRunner.query(`DROP INDEX "IDX_27e45daf821a522cf6c7b794bc"`);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_denied_users" RENAME TO "temporary_plugin_tenant_denied_users"`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_denied_users" ("pluginTenantsId" varchar NOT NULL, "userId" varchar NOT NULL, PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_tenant_denied_users"("pluginTenantsId", "userId") SELECT "pluginTenantsId", "userId" FROM "temporary_plugin_tenant_denied_users"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_tenant_denied_users"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_17fc7d5ec9f51d9716c79b50ae" ON "plugin_tenant_denied_users" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_27e45daf821a522cf6c7b794bc" ON "plugin_tenant_denied_users" ("pluginTenantsId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_99cab633947d311b29e5e3d9f1"`);
		await queryRunner.query(`DROP INDEX "IDX_358b3ee7d6cac92234c829e384"`);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_users" RENAME TO "temporary_plugin_tenant_allowed_users"`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_allowed_users" ("pluginTenantsId" varchar NOT NULL, "userId" varchar NOT NULL, PRIMARY KEY ("pluginTenantsId", "userId"))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_tenant_allowed_users"("pluginTenantsId", "userId") SELECT "pluginTenantsId", "userId" FROM "temporary_plugin_tenant_allowed_users"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_tenant_allowed_users"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_99cab633947d311b29e5e3d9f1" ON "plugin_tenant_allowed_users" ("userId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_358b3ee7d6cac92234c829e384" ON "plugin_tenant_allowed_users" ("pluginTenantsId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_0c355caddd182f2e7099d35911"`);
		await queryRunner.query(`DROP INDEX "IDX_12c6c6c88720dfb785a0e066bb"`);
		await queryRunner.query(
			`ALTER TABLE "plugin_tenant_allowed_roles" RENAME TO "temporary_plugin_tenant_allowed_roles"`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenant_allowed_roles" ("pluginTenantsId" varchar NOT NULL, "roleId" varchar NOT NULL, PRIMARY KEY ("pluginTenantsId", "roleId"))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_tenant_allowed_roles"("pluginTenantsId", "roleId") SELECT "pluginTenantsId", "roleId" FROM "temporary_plugin_tenant_allowed_roles"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_tenant_allowed_roles"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_0c355caddd182f2e7099d35911" ON "plugin_tenant_allowed_roles" ("roleId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_12c6c6c88720dfb785a0e066bb" ON "plugin_tenant_allowed_roles" ("pluginTenantsId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_7d05232ee38835a76623154b7b"`);
		await queryRunner.query(`DROP INDEX "IDX_7b12d1d4e5d36737596155ce2d"`);
		await queryRunner.query(`DROP INDEX "IDX_9e3344b0c59fcd4cd699cef727"`);
		await queryRunner.query(`DROP INDEX "IDX_e1d678ee40f241203ee5ad7d41"`);
		await queryRunner.query(`DROP INDEX "IDX_8fb8bf376857199096a73d90b8"`);
		await queryRunner.query(`DROP INDEX "IDX_2c926e12d6fba9b0d320c974f3"`);
		await queryRunner.query(`DROP INDEX "IDX_74d0d8f22af90d92d3213d5e74"`);
		await queryRunner.query(`ALTER TABLE "plugin_billings" RENAME TO "temporary_plugin_billings"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_billings" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "amount" decimal(10,2) NOT NULL, "currency" varchar NOT NULL DEFAULT ('USD'), "billingDate" datetime NOT NULL, "dueDate" datetime NOT NULL, "status" varchar CHECK( "status" IN ('pending','processed','paid','overdue','failed','cancelled','refunded','partially_paid') ) NOT NULL DEFAULT ('pending'), "billingPeriod" varchar CHECK( "billingPeriod" IN ('daily','weekly','monthly','quarterly','yearly','one-time') ) NOT NULL, "billingPeriodStart" datetime NOT NULL, "billingPeriodEnd" datetime NOT NULL, "description" text, "metadata" text, "subscriptionId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_billings"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "amount", "currency", "billingDate", "dueDate", "status", "billingPeriod", "billingPeriodStart", "billingPeriodEnd", "description", "metadata", "subscriptionId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "amount", "currency", "billingDate", "dueDate", "status", "billingPeriod", "billingPeriodStart", "billingPeriodEnd", "description", "metadata", "subscriptionId" FROM "temporary_plugin_billings"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_billings"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d05232ee38835a76623154b7b" ON "plugin_billings" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_7b12d1d4e5d36737596155ce2d" ON "plugin_billings" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9e3344b0c59fcd4cd699cef727" ON "plugin_billings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_e1d678ee40f241203ee5ad7d41" ON "plugin_billings" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8fb8bf376857199096a73d90b8" ON "plugin_billings" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2c926e12d6fba9b0d320c974f3" ON "plugin_billings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_74d0d8f22af90d92d3213d5e74" ON "plugin_billings" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_eb3b9c7cfe7aa86bca589aee9e"`);
		await queryRunner.query(`DROP INDEX "IDX_af82eaa17a59e0cf0fac16d7fe"`);
		await queryRunner.query(`DROP INDEX "IDX_fed0c61e1d142e1c448a45e5a0"`);
		await queryRunner.query(`DROP INDEX "IDX_448990d16086477ee1c5f08968"`);
		await queryRunner.query(`DROP INDEX "IDX_18db53b62833e1bdb9949b5827"`);
		await queryRunner.query(`DROP INDEX "IDX_4e8a9f4ee7df8c39d0314063e7"`);
		await queryRunner.query(`DROP INDEX "IDX_bbd6dc08c0c91724e5d26202fa"`);
		await queryRunner.query(`DROP INDEX "IDX_39a16aca760fc7a3cef39d5563"`);
		await queryRunner.query(`DROP INDEX "IDX_7afeffe18364cae48efd454e4d"`);
		await queryRunner.query(`DROP INDEX "IDX_9bbac226cce476576134c5726e"`);
		await queryRunner.query(`DROP INDEX "IDX_7f792e3c1891f728f9e5256142"`);
		await queryRunner.query(`DROP INDEX "IDX_b5163f874ce5bc6b63c8e8631a"`);
		await queryRunner.query(`DROP INDEX "IDX_18743cb5933b78e2b8081589e4"`);
		await queryRunner.query(`DROP INDEX "IDX_0be98c36cdbaa56f3880bc6baa"`);
		await queryRunner.query(`DROP INDEX "IDX_ddf7be116060ee20bc16128632"`);
		await queryRunner.query(`DROP INDEX "IDX_449b2294593f5787f40a60c8f2"`);
		await queryRunner.query(`ALTER TABLE "plugin_subscriptions" RENAME TO "temporary_plugin_subscriptions"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscriptions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "status" varchar CHECK( "status" IN ('active','cancelled','expired','trial','past_due','suspended','pending') ) NOT NULL DEFAULT ('pending'), "scope" varchar CHECK( "scope" IN ('tenant','organization','user') ) NOT NULL DEFAULT ('tenant'), "startDate" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP), "endDate" datetime, "trialEndDate" datetime, "autoRenew" boolean NOT NULL DEFAULT (1), "cancelledAt" datetime, "cancellationReason" text, "metadata" text, "externalSubscriptionId" varchar, "pluginId" varchar NOT NULL, "pluginTenantId" varchar NOT NULL, "planId" varchar, "subscriberId" varchar, "parentId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_subscriptions"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "scope", "startDate", "endDate", "trialEndDate", "autoRenew", "cancelledAt", "cancellationReason", "metadata", "externalSubscriptionId", "pluginId", "pluginTenantId", "planId", "subscriberId", "parentId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "status", "scope", "startDate", "endDate", "trialEndDate", "autoRenew", "cancelledAt", "cancellationReason", "metadata", "externalSubscriptionId", "pluginId", "pluginTenantId", "planId", "subscriberId", "parentId" FROM "temporary_plugin_subscriptions"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_subscriptions"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_eb3b9c7cfe7aa86bca589aee9e" ON "plugin_subscriptions" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af82eaa17a59e0cf0fac16d7fe" ON "plugin_subscriptions" ("subscriberId", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_fed0c61e1d142e1c448a45e5a0" ON "plugin_subscriptions" ("status", "endDate") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_448990d16086477ee1c5f08968" ON "plugin_subscriptions" ("status", "tenantId") `
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_18db53b62833e1bdb9949b5827" ON "plugin_subscriptions" ("pluginId", "subscriberId", "tenantId") WHERE "subscriberId" IS NOT NULL`
		);
		await queryRunner.query(`CREATE INDEX "IDX_4e8a9f4ee7df8c39d0314063e7" ON "plugin_subscriptions" ("planId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_bbd6dc08c0c91724e5d26202fa" ON "plugin_subscriptions" ("externalSubscriptionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_39a16aca760fc7a3cef39d5563" ON "plugin_subscriptions" ("parentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7afeffe18364cae48efd454e4d" ON "plugin_subscriptions" ("scope", "tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9bbac226cce476576134c5726e" ON "plugin_subscriptions" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7f792e3c1891f728f9e5256142" ON "plugin_subscriptions" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b5163f874ce5bc6b63c8e8631a" ON "plugin_subscriptions" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18743cb5933b78e2b8081589e4" ON "plugin_subscriptions" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0be98c36cdbaa56f3880bc6baa" ON "plugin_subscriptions" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_ddf7be116060ee20bc16128632" ON "plugin_subscriptions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_449b2294593f5787f40a60c8f2" ON "plugin_subscriptions" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_082f6cba880ecd144b28284376"`);
		await queryRunner.query(`DROP INDEX "IDX_37c9e1c698331b9345280374fd"`);
		await queryRunner.query(`DROP INDEX "IDX_234c8f3d694ae31b095bdf5a8a"`);
		await queryRunner.query(`DROP INDEX "IDX_dec9037a57726ae5f54bc3c4a8"`);
		await queryRunner.query(`DROP INDEX "IDX_a7bf8b446ca66e5824fb6ff91a"`);
		await queryRunner.query(`DROP INDEX "IDX_6f401b811d14d8b06db0fbea30"`);
		await queryRunner.query(`DROP INDEX "IDX_b874f9ee9c04061b4892926388"`);
		await queryRunner.query(`DROP INDEX "IDX_646aa1161ac9861061842e05c2"`);
		await queryRunner.query(
			`ALTER TABLE "plugin_subscription_plans" RENAME TO "temporary_plugin_subscription_plans"`
		);
		await queryRunner.query(
			`CREATE TABLE "plugin_subscription_plans" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "name" varchar NOT NULL, "description" text, "type" varchar CHECK( "type" IN ('free','trial','basic','premium','enterprise','custom') ) NOT NULL DEFAULT ('free'), "price" decimal(10,2) NOT NULL DEFAULT (0), "currency" varchar(3) NOT NULL DEFAULT ('USD'), "billingPeriod" varchar CHECK( "billingPeriod" IN ('daily','weekly','monthly','quarterly','yearly','one-time') ) NOT NULL DEFAULT ('monthly'), "features" text NOT NULL, "limitations" text, "isPopular" boolean NOT NULL DEFAULT (0), "isRecommended" boolean NOT NULL DEFAULT (0), "trialDays" integer, "setupFee" decimal(10,2), "discountPercentage" decimal(5,2), "metadata" text, "sortOrder" integer NOT NULL DEFAULT (0), "pluginId" varchar NOT NULL, "createdById" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_subscription_plans"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "price", "currency", "billingPeriod", "features", "limitations", "isPopular", "isRecommended", "trialDays", "setupFee", "discountPercentage", "metadata", "sortOrder", "pluginId", "createdById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "price", "currency", "billingPeriod", "features", "limitations", "isPopular", "isRecommended", "trialDays", "setupFee", "discountPercentage", "metadata", "sortOrder", "pluginId", "createdById" FROM "temporary_plugin_subscription_plans"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_subscription_plans"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_082f6cba880ecd144b28284376" ON "plugin_subscription_plans" ("pluginId", "type") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_37c9e1c698331b9345280374fd" ON "plugin_subscription_plans" ("isActive", "type") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_234c8f3d694ae31b095bdf5a8a" ON "plugin_subscription_plans" ("price", "billingPeriod") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dec9037a57726ae5f54bc3c4a8" ON "plugin_subscription_plans" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7bf8b446ca66e5824fb6ff91a" ON "plugin_subscription_plans" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f401b811d14d8b06db0fbea30" ON "plugin_subscription_plans" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b874f9ee9c04061b4892926388" ON "plugin_subscription_plans" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_646aa1161ac9861061842e05c2" ON "plugin_subscription_plans" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_0479844f05c1132f8929cab1c8"`);
		await queryRunner.query(`DROP INDEX "IDX_6c8d4a0f437cfae296ef43ce13"`);
		await queryRunner.query(`DROP INDEX "IDX_c0fab3c6709a93bca88eb100a9"`);
		await queryRunner.query(`DROP INDEX "IDX_123f1b37f4826f6241446a8416"`);
		await queryRunner.query(`DROP INDEX "IDX_15ca158f27ab3296915b7d1b38"`);
		await queryRunner.query(`DROP INDEX "IDX_4bf89f98c41969e23e3f9974d5"`);
		await queryRunner.query(`DROP INDEX "IDX_16d0aed6fcc311379f5c75bbd2"`);
		await queryRunner.query(`DROP INDEX "IDX_100eef6409ee96d0673ee510e6"`);
		await queryRunner.query(`DROP INDEX "IDX_35ee1cb5098e17e30ee5cbc705"`);
		await queryRunner.query(`DROP INDEX "IDX_c61c7032e7b3afd352d82bc4b4"`);
		await queryRunner.query(`DROP INDEX "IDX_d0a1444aa92229d7f1af237184"`);
		await queryRunner.query(`DROP INDEX "IDX_3210c015451d02d015a23eedad"`);
		await queryRunner.query(`DROP INDEX "IDX_61357761fc6b140180b104dc8d"`);
		await queryRunner.query(`DROP INDEX "IDX_cc5b64091fbfdcdbd23d6da80e"`);
		await queryRunner.query(`ALTER TABLE "plugins" RENAME TO "temporary_plugins"`);
		await queryRunner.query(
			`CREATE TABLE "plugins" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "name" varchar NOT NULL, "description" varchar, "type" varchar CHECK( "type" IN ('DESKTOP','WEB','MOBILE') ) NOT NULL DEFAULT ('DESKTOP'), "status" varchar CHECK( "status" IN ('ACTIVE','INACTIVE','DEPRECATED','ARCHIVED') ) NOT NULL DEFAULT ('ACTIVE'), "categoryId" varchar, "author" varchar, "license" varchar, "homepage" varchar, "repository" varchar, "uploadedById" varchar, "uploadedAt" datetime, "requiresSubscription" boolean NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), "isVerified" boolean NOT NULL DEFAULT (0), "lastDownloadedAt" datetime)`
		);
		await queryRunner.query(
			`INSERT INTO "plugins"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "status", "categoryId", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "requiresSubscription", "isFeatured", "isVerified", "lastDownloadedAt") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "name", "description", "type", "status", "categoryId", "author", "license", "homepage", "repository", "uploadedById", "uploadedAt", "requiresSubscription", "isFeatured", "isVerified", "lastDownloadedAt" FROM "temporary_plugins"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugins"`);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0479844f05c1132f8929cab1c8" ON "plugins" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_6c8d4a0f437cfae296ef43ce13" ON "plugins" ("status", "type") `);
		await queryRunner.query(`CREATE INDEX "IDX_c0fab3c6709a93bca88eb100a9" ON "plugins" ("status", "isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_123f1b37f4826f6241446a8416" ON "plugins" ("isVerified") `);
		await queryRunner.query(`CREATE INDEX "IDX_15ca158f27ab3296915b7d1b38" ON "plugins" ("isFeatured") `);
		await queryRunner.query(`CREATE INDEX "IDX_4bf89f98c41969e23e3f9974d5" ON "plugins" ("uploadedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_16d0aed6fcc311379f5c75bbd2" ON "plugins" ("categoryId") `);
		await queryRunner.query(`CREATE INDEX "IDX_100eef6409ee96d0673ee510e6" ON "plugins" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_35ee1cb5098e17e30ee5cbc705" ON "plugins" ("type") `);
		await queryRunner.query(`CREATE INDEX "IDX_c61c7032e7b3afd352d82bc4b4" ON "plugins" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_d0a1444aa92229d7f1af237184" ON "plugins" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_3210c015451d02d015a23eedad" ON "plugins" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_61357761fc6b140180b104dc8d" ON "plugins" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cc5b64091fbfdcdbd23d6da80e" ON "plugins" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_39d060301c8a36b51da6e4aec3"`);
		await queryRunner.query(`DROP INDEX "IDX_f5c8259c0d815486f31878864d"`);
		await queryRunner.query(`DROP INDEX "IDX_e1e7cf1589d06ac02a12e41db0"`);
		await queryRunner.query(`DROP INDEX "IDX_e632aa70ea7b7e5c5fdbfba41b"`);
		await queryRunner.query(`DROP INDEX "IDX_6fa0eda3add1fb070ba172a44e"`);
		await queryRunner.query(`DROP INDEX "IDX_8adf7a9181e968bcafc71236c8"`);
		await queryRunner.query(`DROP INDEX "IDX_ab6e29cd444226f80bf0c0c1db"`);
		await queryRunner.query(`DROP INDEX "IDX_f806bae81cd490404a1888ad5b"`);
		await queryRunner.query(`DROP INDEX "IDX_650ccf2e7394509f7ad8448e32"`);
		await queryRunner.query(`DROP INDEX "IDX_a16869769b9a219acb157bb2b3"`);
		await queryRunner.query(`DROP INDEX "IDX_e6d49799b916946e5cd5399385"`);
		await queryRunner.query(`DROP INDEX "IDX_e06094816e67e584dea754cc81"`);
		await queryRunner.query(`DROP INDEX "IDX_0b36b5701e9890a395ded76cb5"`);
		await queryRunner.query(`DROP INDEX "IDX_485db4d1cc977cc3d499824d95"`);
		await queryRunner.query(`ALTER TABLE "plugin_versions" RENAME TO "temporary_plugin_versions"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_versions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "number" varchar NOT NULL, "changelog" varchar NOT NULL, "checksum" varchar, "signature" varchar, "releaseDate" datetime, "downloadCount" integer DEFAULT (0), "pluginId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_versions"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "number", "changelog", "checksum", "signature", "releaseDate", "downloadCount", "pluginId" FROM "temporary_plugin_versions"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_versions"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_39d060301c8a36b51da6e4aec3" ON "plugin_versions" ("pluginId", "organizationId", "number") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f5c8259c0d815486f31878864d" ON "plugin_versions" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e1e7cf1589d06ac02a12e41db0" ON "plugin_versions" ("pluginId", "releaseDate") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e632aa70ea7b7e5c5fdbfba41b" ON "plugin_versions" ("number") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6fa0eda3add1fb070ba172a44e" ON "plugin_versions" ("downloadCount") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8adf7a9181e968bcafc71236c8" ON "plugin_versions" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ab6e29cd444226f80bf0c0c1db" ON "plugin_versions" ("releaseDate") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f806bae81cd490404a1888ad5b" ON "plugin_versions" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_650ccf2e7394509f7ad8448e32" ON "plugin_versions" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a16869769b9a219acb157bb2b3" ON "plugin_versions" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_e6d49799b916946e5cd5399385" ON "plugin_versions" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e06094816e67e584dea754cc81" ON "plugin_versions" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b36b5701e9890a395ded76cb5" ON "plugin_versions" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_485db4d1cc977cc3d499824d95" ON "plugin_versions" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_6fae6d0ddfd7177abcb4befd72"`);
		await queryRunner.query(`DROP INDEX "IDX_af8978fbf37560525c19ec7048"`);
		await queryRunner.query(`DROP INDEX "IDX_d658bc853b354445cf2a0d6fb7"`);
		await queryRunner.query(`DROP INDEX "IDX_55bee446d2c470e5d6b066a27a"`);
		await queryRunner.query(`DROP INDEX "IDX_7c6dc1cdd58690b7179d76184b"`);
		await queryRunner.query(`DROP INDEX "IDX_19d9135639e3b40ec0dca1c926"`);
		await queryRunner.query(`DROP INDEX "IDX_0ab83b39cc676ee2097714fb3b"`);
		await queryRunner.query(`DROP INDEX "IDX_cb9a1e5640b8e07a9a63b51245"`);
		await queryRunner.query(`DROP INDEX "IDX_c90b796bd033e54e3719213a0c"`);
		await queryRunner.query(`DROP INDEX "IDX_0404416b5c1cd48ae87fe81834"`);
		await queryRunner.query(`DROP INDEX "IDX_09a383d6f2858d49c064ca4cda"`);
		await queryRunner.query(`ALTER TABLE "plugin_sources" RENAME TO "temporary_plugin_sources"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_sources" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar CHECK( "type" IN ('CDN','NPM','GAUZY') ) NOT NULL DEFAULT ('GAUZY'), "operatingSystem" varchar CHECK( "operatingSystem" IN ('LINUX','MAC','WINDOWS','UNIVERSAL') ) NOT NULL DEFAULT ('UNIVERSAL'), "architecture" varchar CHECK( "architecture" IN ('X64','ARM') ) NOT NULL DEFAULT ('X64'), "url" varchar, "integrity" varchar, "crossOrigin" varchar, "name" varchar, "registry" varchar, "private" boolean DEFAULT (0), "scope" varchar, "filePath" varchar, "fileName" varchar, "fileSize" integer, "mimeType" varchar, "fileKey" varchar, "versionId" varchar, "storageProvider" varchar CHECK( "storageProvider" IN ('LOCAL','S3','WASABI','CLOUDINARY','DIGITALOCEAN') ))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_sources"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "operatingSystem", "architecture", "url", "integrity", "crossOrigin", "name", "registry", "private", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "versionId", "storageProvider") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type", "operatingSystem", "architecture", "url", "integrity", "crossOrigin", "name", "registry", "private", "scope", "filePath", "fileName", "fileSize", "mimeType", "fileKey", "versionId", "storageProvider" FROM "temporary_plugin_sources"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_sources"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_6fae6d0ddfd7177abcb4befd72" ON "plugin_sources" ("versionId", "operatingSystem", "architecture", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_af8978fbf37560525c19ec7048" ON "plugin_sources" ("tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d658bc853b354445cf2a0d6fb7" ON "plugin_sources" ("storageProvider") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_55bee446d2c470e5d6b066a27a" ON "plugin_sources" ("versionId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7c6dc1cdd58690b7179d76184b" ON "plugin_sources" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_19d9135639e3b40ec0dca1c926" ON "plugin_sources" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ab83b39cc676ee2097714fb3b" ON "plugin_sources" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb9a1e5640b8e07a9a63b51245" ON "plugin_sources" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_c90b796bd033e54e3719213a0c" ON "plugin_sources" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0404416b5c1cd48ae87fe81834" ON "plugin_sources" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_09a383d6f2858d49c064ca4cda" ON "plugin_sources" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_1569d8ca526d958d82483e15c7"`);
		await queryRunner.query(`DROP INDEX "IDX_173e0668b17afd3696abf3c518"`);
		await queryRunner.query(`DROP INDEX "IDX_3c3ce338e7716d853220d8b176"`);
		await queryRunner.query(`DROP INDEX "IDX_5e6b80341a4ed75ae7c4af6897"`);
		await queryRunner.query(`DROP INDEX "IDX_c92ea21dfcfd889730e2214c8f"`);
		await queryRunner.query(`DROP INDEX "IDX_28624735b4e3ace75883521a57"`);
		await queryRunner.query(`DROP INDEX "IDX_32c3f7a738ec8b40d6375b2933"`);
		await queryRunner.query(`DROP INDEX "IDX_acac58b213936ea488d0a8d1a3"`);
		await queryRunner.query(`DROP INDEX "IDX_547e4b71ae81ee772fa4ab79e6"`);
		await queryRunner.query(`DROP INDEX "IDX_8aafffefdce2eb11079ec2aa75"`);
		await queryRunner.query(`DROP INDEX "IDX_dff9e6c763c8c33b07f330e6a1"`);
		await queryRunner.query(`DROP INDEX "IDX_3e63eed07bcc0e3e36d9183cca"`);
		await queryRunner.query(`DROP INDEX "IDX_d742ed346264f4c9d9225265d7"`);
		await queryRunner.query(`DROP INDEX "IDX_a45f5c2aba22d4fa4eb8fa85af"`);
		await queryRunner.query(`DROP INDEX "IDX_7e9b8b3eebb881753e07b73f6c"`);
		await queryRunner.query(`DROP INDEX "IDX_842e5e5f94c4008a42d4b5f44a"`);
		await queryRunner.query(`ALTER TABLE "plugin_installations" RENAME TO "temporary_plugin_installations"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_installations" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar(36), "versionId" varchar(36), "installedById" varchar(36), "installedAt" datetime, "uninstalledAt" datetime, "status" varchar CHECK( "status" IN ('INSTALLED','UNINSTALLED','FAILED','IN_PROGRESS') ) NOT NULL DEFAULT ('IN_PROGRESS'), "isActivated" boolean NOT NULL DEFAULT (0), "activatedAt" datetime, "deactivatedAt" datetime)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_installations"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status", "isActivated", "activatedAt", "deactivatedAt") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "versionId", "installedById", "installedAt", "uninstalledAt", "status", "isActivated", "activatedAt", "deactivatedAt" FROM "temporary_plugin_installations"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_installations"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1569d8ca526d958d82483e15c7" ON "plugin_installations" ("pluginId", "tenantId", "organizationId", "installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_173e0668b17afd3696abf3c518" ON "plugin_installations" ("installedById", "pluginId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3c3ce338e7716d853220d8b176" ON "plugin_installations" ("deactivatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e6b80341a4ed75ae7c4af6897" ON "plugin_installations" ("activatedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c92ea21dfcfd889730e2214c8f" ON "plugin_installations" ("uninstalledAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_28624735b4e3ace75883521a57" ON "plugin_installations" ("installedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_32c3f7a738ec8b40d6375b2933" ON "plugin_installations" ("installedById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_acac58b213936ea488d0a8d1a3" ON "plugin_installations" ("versionId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_547e4b71ae81ee772fa4ab79e6" ON "plugin_installations" ("pluginId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8aafffefdce2eb11079ec2aa75" ON "plugin_installations" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dff9e6c763c8c33b07f330e6a1" ON "plugin_installations" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3e63eed07bcc0e3e36d9183cca" ON "plugin_installations" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d742ed346264f4c9d9225265d7" ON "plugin_installations" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a45f5c2aba22d4fa4eb8fa85af" ON "plugin_installations" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7e9b8b3eebb881753e07b73f6c" ON "plugin_installations" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_842e5e5f94c4008a42d4b5f44a" ON "plugin_installations" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_676e7c749905331c36b1707ba8"`);
		await queryRunner.query(`DROP INDEX "IDX_cddb5e04a93a957dc4d56522b7"`);
		await queryRunner.query(`DROP INDEX "IDX_17c923b300710a13f6dfade59b"`);
		await queryRunner.query(`DROP INDEX "IDX_df3d0fc648c9e0544ca11df9d2"`);
		await queryRunner.query(`DROP INDEX "IDX_05292c8750270ff028ab2fec14"`);
		await queryRunner.query(`DROP INDEX "IDX_8bcd0243b780191a391b348f58"`);
		await queryRunner.query(`DROP INDEX "IDX_da359f059e06030ec33adba133"`);
		await queryRunner.query(`DROP INDEX "IDX_cacbb5fd767b06985be6049858"`);
		await queryRunner.query(`DROP INDEX "IDX_fe4db46e2c3d32f64b4a4728e3"`);
		await queryRunner.query(`DROP INDEX "IDX_09654ebaec00e0c0c4dfae4c42"`);
		await queryRunner.query(`DROP INDEX "IDX_ee480ffb800fb2c9f6d91f66aa"`);
		await queryRunner.query(`DROP INDEX "IDX_9b013a85a6ae26db17101ffb89"`);
		await queryRunner.query(`ALTER TABLE "plugin_tags" RENAME TO "temporary_plugin_tags"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_tags" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar NOT NULL, "tagId" varchar NOT NULL, "appliedAt" text DEFAULT (CURRENT_TIMESTAMP), "appliedById" varchar, "priority" integer DEFAULT (50), "isFeatured" boolean NOT NULL DEFAULT (0))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_tags"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "tagId", "appliedAt", "appliedById", "priority", "isFeatured") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "tagId", "appliedAt", "appliedById", "priority", "isFeatured" FROM "temporary_plugin_tags"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_tags"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_676e7c749905331c36b1707ba8" ON "plugin_tags" ("pluginId", "tagId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_cddb5e04a93a957dc4d56522b7" ON "plugin_tags" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_17c923b300710a13f6dfade59b" ON "plugin_tags" ("tagId", "tenantId", "organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_df3d0fc648c9e0544ca11df9d2" ON "plugin_tags" ("tagId") `);
		await queryRunner.query(`CREATE INDEX "IDX_05292c8750270ff028ab2fec14" ON "plugin_tags" ("pluginId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8bcd0243b780191a391b348f58" ON "plugin_tags" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_da359f059e06030ec33adba133" ON "plugin_tags" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cacbb5fd767b06985be6049858" ON "plugin_tags" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_fe4db46e2c3d32f64b4a4728e3" ON "plugin_tags" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_09654ebaec00e0c0c4dfae4c42" ON "plugin_tags" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ee480ffb800fb2c9f6d91f66aa" ON "plugin_tags" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9b013a85a6ae26db17101ffb89" ON "plugin_tags" ("createdByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_ca31918911db08a4008be72c8e"`);
		await queryRunner.query(`DROP INDEX "IDX_7c239f665e5caedd708c62b1f7"`);
		await queryRunner.query(`DROP INDEX "IDX_b23665ef0d73dbe47d4d26f3d5"`);
		await queryRunner.query(`DROP INDEX "IDX_99ab190a6b7ae5ffc61b4dfaf4"`);
		await queryRunner.query(`DROP INDEX "IDX_1fa4520b20a0bf4fdfe3ca1ec7"`);
		await queryRunner.query(`DROP INDEX "IDX_c7c4b6b97be418be173859d10d"`);
		await queryRunner.query(`DROP INDEX "IDX_60543808734ff13850d7843f7b"`);
		await queryRunner.query(`ALTER TABLE "plugin_categories" RENAME TO "temporary_plugin_categories"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_categories" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" text, "slug" varchar NOT NULL, "color" varchar, "icon" varchar, "order" integer NOT NULL DEFAULT (0), "metadata" text, "parentId" varchar, CONSTRAINT "UQ_d427c34c4dd721c72d5d56187f9" UNIQUE ("slug"))`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_categories"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "slug", "color", "icon", "order", "metadata", "parentId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "name", "description", "slug", "color", "icon", "order", "metadata", "parentId" FROM "temporary_plugin_categories"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_categories"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ca31918911db08a4008be72c8e" ON "plugin_categories" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_7c239f665e5caedd708c62b1f7" ON "plugin_categories" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b23665ef0d73dbe47d4d26f3d5" ON "plugin_categories" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_99ab190a6b7ae5ffc61b4dfaf4" ON "plugin_categories" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1fa4520b20a0bf4fdfe3ca1ec7" ON "plugin_categories" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c7c4b6b97be418be173859d10d" ON "plugin_categories" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_60543808734ff13850d7843f7b" ON "plugin_categories" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_48aa394150a960cf3e7b285cf4"`);
		await queryRunner.query(`DROP INDEX "IDX_734649a34ee071f44de4a14490"`);
		await queryRunner.query(`DROP INDEX "IDX_a8471a91f63494a0d3ec5cf248"`);
		await queryRunner.query(`DROP INDEX "IDX_8e11188fb92db2ee126b53e866"`);
		await queryRunner.query(`DROP INDEX "IDX_737e0935140d7b17632fc7815a"`);
		await queryRunner.query(`DROP INDEX "IDX_d4504369b0f19d2360a464408a"`);
		await queryRunner.query(`DROP INDEX "IDX_bbced9536ca0a8ee967b531c32"`);
		await queryRunner.query(`DROP INDEX "IDX_199b3708ea7962d21fc55de243"`);
		await queryRunner.query(`DROP INDEX "IDX_cf20745f234b0b3512c03d74be"`);
		await queryRunner.query(`DROP INDEX "IDX_a97ab238dc6aff5f305d37dbc7"`);
		await queryRunner.query(`DROP INDEX "IDX_6b8deef29d0fb5eee571c39b39"`);
		await queryRunner.query(`DROP INDEX "IDX_5534e36ff3a1416c17f507d546"`);
		await queryRunner.query(`ALTER TABLE "plugin_settings" RENAME TO "temporary_plugin_settings"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_settings" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "key" varchar NOT NULL, "value" text NOT NULL, "isRequired" boolean NOT NULL DEFAULT (0), "isEncrypted" boolean NOT NULL DEFAULT (0), "description" text, "order" integer, "validationRules" text, "dataType" varchar CHECK( "dataType" IN ('string','number','boolean','json','file') ) NOT NULL DEFAULT ('string'), "defaultValue" varchar, "pluginId" varchar NOT NULL, "pluginTenantId" varchar, "categoryId" varchar, "updatedById" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_settings"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "key", "value", "isRequired", "isEncrypted", "description", "order", "validationRules", "dataType", "defaultValue", "pluginId", "pluginTenantId", "categoryId", "updatedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "key", "value", "isRequired", "isEncrypted", "description", "order", "validationRules", "dataType", "defaultValue", "pluginId", "pluginTenantId", "categoryId", "updatedById" FROM "temporary_plugin_settings"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_settings"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_48aa394150a960cf3e7b285cf4" ON "plugin_settings" ("pluginId", "key", "pluginTenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_734649a34ee071f44de4a14490" ON "plugin_settings" ("updatedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_a8471a91f63494a0d3ec5cf248" ON "plugin_settings" ("categoryId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8e11188fb92db2ee126b53e866" ON "plugin_settings" ("pluginTenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_737e0935140d7b17632fc7815a" ON "plugin_settings" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_d4504369b0f19d2360a464408a" ON "plugin_settings" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_bbced9536ca0a8ee967b531c32" ON "plugin_settings" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_199b3708ea7962d21fc55de243" ON "plugin_settings" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf20745f234b0b3512c03d74be" ON "plugin_settings" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_a97ab238dc6aff5f305d37dbc7" ON "plugin_settings" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b8deef29d0fb5eee571c39b39" ON "plugin_settings" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5534e36ff3a1416c17f507d546" ON "plugin_settings" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_1394aebfcfe6782051e76f46a5"`);
		await queryRunner.query(`DROP INDEX "IDX_a3a616a07b21a4212736493f5e"`);
		await queryRunner.query(`DROP INDEX "IDX_69f72957e1c98832cdab0c486e"`);
		await queryRunner.query(`DROP INDEX "IDX_4f1dada611375594ce22411cbe"`);
		await queryRunner.query(`DROP INDEX "IDX_52ca2ab9f943fe3f47df36aef7"`);
		await queryRunner.query(`DROP INDEX "IDX_a32259b1b9cdeea1c6d94bf94c"`);
		await queryRunner.query(`DROP INDEX "IDX_1aca41d7ee08b3b140eae4ee88"`);
		await queryRunner.query(`DROP INDEX "IDX_c4accce384c6007c92b9afdc2d"`);
		await queryRunner.query(`DROP INDEX "IDX_e723cb5fdc4092538fe0384853"`);
		await queryRunner.query(`DROP INDEX "IDX_6d6a338f4eb5b467c2ff5eaa4b"`);
		await queryRunner.query(`DROP INDEX "IDX_c47db2e2072ba3b57060819246"`);
		await queryRunner.query(`DROP INDEX "IDX_545faee53386f4e9d7b4311104"`);
		await queryRunner.query(`DROP INDEX "IDX_5df2b63d82f2168e43c2d7e64c"`);
		await queryRunner.query(`DROP INDEX "IDX_0ed7c977facb534e572d33b485"`);
		await queryRunner.query(`DROP INDEX "IDX_cf185e176c869e2be48d00d648"`);
		await queryRunner.query(`DROP INDEX "IDX_06f10073cd6e84a19b6f604ddd"`);
		await queryRunner.query(`DROP INDEX "IDX_0b5cc71673410a449491fb3db9"`);
		await queryRunner.query(`DROP INDEX "IDX_f209a8620f1677ed2c82c4cd2e"`);
		await queryRunner.query(`ALTER TABLE "plugin_tenants" RENAME TO "temporary_plugin_tenants"`);
		await queryRunner.query(
			`CREATE TABLE "plugin_tenants" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "pluginId" varchar NOT NULL, "enabled" boolean NOT NULL DEFAULT (1), "scope" varchar CHECK( "scope" IN ('tenant','organization','user') ) NOT NULL DEFAULT ('user'), "autoInstall" boolean NOT NULL DEFAULT (0), "requiresApproval" boolean NOT NULL DEFAULT (1), "isMandatory" boolean NOT NULL DEFAULT (0), "maxInstallations" integer, "maxActiveUsers" integer, "currentInstallations" integer NOT NULL DEFAULT (0), "currentActiveUsers" integer NOT NULL DEFAULT (0), "tenantConfiguration" text, "preferences" text, "approvedAt" text, "isDataCompliant" boolean NOT NULL DEFAULT (1), "complianceCertifications" text, "approvedById" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "plugin_tenants"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "enabled", "scope", "autoInstall", "requiresApproval", "isMandatory", "maxInstallations", "maxActiveUsers", "currentInstallations", "currentActiveUsers", "tenantConfiguration", "preferences", "approvedAt", "isDataCompliant", "complianceCertifications", "approvedById") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "pluginId", "enabled", "scope", "autoInstall", "requiresApproval", "isMandatory", "maxInstallations", "maxActiveUsers", "currentInstallations", "currentActiveUsers", "tenantConfiguration", "preferences", "approvedAt", "isDataCompliant", "complianceCertifications", "approvedById" FROM "temporary_plugin_tenants"`
		);
		await queryRunner.query(`DROP TABLE "temporary_plugin_tenants"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_1394aebfcfe6782051e76f46a5" ON "plugin_tenants" ("pluginId", "tenantId", "organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a3a616a07b21a4212736493f5e" ON "plugin_tenants" ("tenantId", "scope", "enabled") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_69f72957e1c98832cdab0c486e" ON "plugin_tenants" ("organizationId", "scope") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4f1dada611375594ce22411cbe" ON "plugin_tenants" ("pluginId", "enabled") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_52ca2ab9f943fe3f47df36aef7" ON "plugin_tenants" ("approvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_a32259b1b9cdeea1c6d94bf94c" ON "plugin_tenants" ("approvedAt") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_1aca41d7ee08b3b140eae4ee88" ON "plugin_tenants" ("currentActiveUsers") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c4accce384c6007c92b9afdc2d" ON "plugin_tenants" ("currentInstallations") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_e723cb5fdc4092538fe0384853" ON "plugin_tenants" ("scope") `);
		await queryRunner.query(`CREATE INDEX "IDX_6d6a338f4eb5b467c2ff5eaa4b" ON "plugin_tenants" ("enabled") `);
		await queryRunner.query(`CREATE INDEX "IDX_c47db2e2072ba3b57060819246" ON "plugin_tenants" ("pluginId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_545faee53386f4e9d7b4311104" ON "plugin_tenants" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_5df2b63d82f2168e43c2d7e64c" ON "plugin_tenants" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0ed7c977facb534e572d33b485" ON "plugin_tenants" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_cf185e176c869e2be48d00d648" ON "plugin_tenants" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_06f10073cd6e84a19b6f604ddd" ON "plugin_tenants" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0b5cc71673410a449491fb3db9" ON "plugin_tenants" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f209a8620f1677ed2c82c4cd2e" ON "plugin_tenants" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_63d9e137716eb1bdfe93ccf23d"`);
		await queryRunner.query(`DROP INDEX "IDX_f120aba634b63389a3a351a4f5"`);
		await queryRunner.query(`DROP INDEX "IDX_f955d4fc2146d3696c9af8f068"`);
		await queryRunner.query(`DROP INDEX "IDX_382c80e92aa263e9cd2e98a664"`);
		await queryRunner.query(`DROP INDEX "IDX_d79d3bd6115187d2e73ea8b3ff"`);
		await queryRunner.query(`DROP INDEX "IDX_228e69500a55e2f311c0219d9f"`);
		await queryRunner.query(`DROP INDEX "IDX_674bdff03d51898ca8a237f163"`);
		await queryRunner.query(`DROP INDEX "IDX_12a0a79f962a124f93c8796e4b"`);
		await queryRunner.query(`DROP INDEX "IDX_ba7262af6a2906c992fe8ca3fe"`);
		await queryRunner.query(`DROP INDEX "IDX_aed773ef44611150e65749733b"`);
		await queryRunner.query(`DROP INDEX "IDX_8966a6ed4ff080f259844c38b9"`);
		await queryRunner.query(`DROP INDEX "IDX_dc605390f47dd26469f855307d"`);
		await queryRunner.query(`ALTER TABLE "time_slot_session" RENAME TO "temporary_time_slot_session"`);
		await queryRunner.query(
			`CREATE TABLE "time_slot_session" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "sessionId" varchar NOT NULL, "startTime" datetime, "lastActivity" datetime, "timeSlotId" varchar NOT NULL, "employeeId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "time_slot_session"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "sessionId", "startTime", "lastActivity", "timeSlotId", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "sessionId", "startTime", "lastActivity", "timeSlotId", "employeeId" FROM "temporary_time_slot_session"`
		);
		await queryRunner.query(`DROP TABLE "temporary_time_slot_session"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_63d9e137716eb1bdfe93ccf23d" ON "time_slot_session" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f120aba634b63389a3a351a4f5" ON "time_slot_session" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f955d4fc2146d3696c9af8f068" ON "time_slot_session" ("deletedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_382c80e92aa263e9cd2e98a664" ON "time_slot_session" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_d79d3bd6115187d2e73ea8b3ff" ON "time_slot_session" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_228e69500a55e2f311c0219d9f" ON "time_slot_session" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_674bdff03d51898ca8a237f163" ON "time_slot_session" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_12a0a79f962a124f93c8796e4b" ON "time_slot_session" ("sessionId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ba7262af6a2906c992fe8ca3fe" ON "time_slot_session" ("startTime") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_aed773ef44611150e65749733b" ON "time_slot_session" ("lastActivity") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8966a6ed4ff080f259844c38b9" ON "time_slot_session" ("timeSlotId") `);
		await queryRunner.query(`CREATE INDEX "IDX_dc605390f47dd26469f855307d" ON "time_slot_session" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_636b2ccafeee793bb7edc5a591"`);
		await queryRunner.query(`DROP INDEX "IDX_c9b171391d920c279fae8a1bf2"`);
		await queryRunner.query(`DROP INDEX "IDX_47b6a97e09895a06606a4a8042"`);
		await queryRunner.query(`DROP INDEX "IDX_7965db2b12872551b586f76dd7"`);
		await queryRunner.query(`DROP INDEX "IDX_2360aa7a4b5ab99e026584f305"`);
		await queryRunner.query(`DROP INDEX "IDX_15458cef74076623c270500053"`);
		await queryRunner.query(`DROP INDEX "IDX_9ea70bf5c390b00e7bb96b86ed"`);
		await queryRunner.query(`DROP INDEX "IDX_c75285bf286b17c7ca5537857b"`);
		await queryRunner.query(`DROP INDEX "IDX_f37d866c3326eca5f579cef35c"`);
		await queryRunner.query(`DROP INDEX "IDX_b03a8a28f6ebdb6df8f630216b"`);
		await queryRunner.query(`DROP INDEX "IDX_6cc2b2052744e352834a4c9e78"`);
		await queryRunner.query(`DROP INDEX "IDX_40460ab803bf6e5a62b75a35c5"`);
		await queryRunner.query(`DROP INDEX "IDX_03e5eecc2328eb545ff748cbdd"`);
		await queryRunner.query(`DROP INDEX "IDX_c21e615583a3ebbb0977452afb"`);
		await queryRunner.query(`DROP INDEX "IDX_745a293c8b2c750bc421fa0633"`);
		await queryRunner.query(`DROP INDEX "IDX_6de52b8f3de32abee3df2628a3"`);
		await queryRunner.query(`DROP INDEX "IDX_b2091c1795f1d0d919b278ab23"`);
		await queryRunner.query(`DROP INDEX "IDX_45db25594e621f1629a9fd69b9"`);
		await queryRunner.query(`ALTER TABLE "organization" RENAME TO "temporary_organization"`);
		await queryRunner.query(
			`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "profile_link" varchar, "banner" varchar, "totalEmployees" integer, "short_description" varchar, "client_focus" varchar, "overview" varchar, "imageUrl" varchar(500), "currency" varchar NOT NULL, "valueDate" datetime, "defaultValueDateType" varchar CHECK( "defaultValueDateType" IN ('TODAY','END_OF_MONTH','START_OF_MONTH') ) DEFAULT ('TODAY'), "isActive" boolean DEFAULT (1), "defaultAlignmentType" varchar, "timeZone" varchar, "regionCode" varchar, "brandColor" varchar, "dateFormat" varchar, "officialName" varchar, "startWeekOn" varchar, "taxId" varchar, "numberFormat" varchar, "minimumProjectSize" varchar, "bonusType" varchar, "bonusPercentage" integer, "invitesAllowed" boolean DEFAULT (1), "show_income" boolean, "show_profits" boolean, "show_bonuses_paid" boolean, "show_total_hours" boolean, "show_minimum_project_size" boolean, "show_projects_count" boolean, "show_clients_count" boolean, "show_clients" boolean, "show_employees_count" boolean, "inviteExpiryPeriod" integer, "fiscalStartDate" datetime, "fiscalEndDate" datetime, "registrationDate" datetime, "futureDateAllowed" boolean, "allowManualTime" boolean NOT NULL DEFAULT (1), "allowModifyTime" boolean NOT NULL DEFAULT (1), "allowDeleteTime" boolean NOT NULL DEFAULT (1), "requireReason" boolean NOT NULL DEFAULT (0), "requireDescription" boolean NOT NULL DEFAULT (0), "requireProject" boolean NOT NULL DEFAULT (0), "requireTask" boolean NOT NULL DEFAULT (0), "requireClient" boolean NOT NULL DEFAULT (0), "timeFormat" integer NOT NULL DEFAULT (12), "separateInvoiceItemTaxAndDiscount" boolean, "website" varchar, "fiscalInformation" varchar, "currencyPosition" varchar NOT NULL DEFAULT ('LEFT'), "discountAfterTax" boolean, "defaultStartTime" varchar, "defaultEndTime" varchar, "defaultInvoiceEstimateTerms" varchar, "convertAcceptedEstimates" boolean, "daysUntilDue" integer, "contactId" varchar, "allowTrackInactivity" boolean NOT NULL DEFAULT (1), "inactivityTimeLimit" integer NOT NULL DEFAULT (10), "activityProofDuration" integer NOT NULL DEFAULT (1), "isRemoveIdleTime" boolean NOT NULL DEFAULT (0), "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "imageId" varchar, "upworkOrganizationId" varchar, "upworkOrganizationName" varchar, "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "randomScreenshot" boolean DEFAULT (0), "trackOnSleep" boolean DEFAULT (0), "screenshotFrequency" numeric NOT NULL DEFAULT (10), "enforced" boolean DEFAULT (0), "archivedAt" datetime, "standardWorkHoursPerDay" integer DEFAULT (8), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "allowAgentAppExit" boolean NOT NULL DEFAULT (1), "allowLogoutFromAgentApp" boolean NOT NULL DEFAULT (1), "trackKeyboardMouseActivity" boolean NOT NULL DEFAULT (0), "trackAllDisplays" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_45db25594e621f1629a9fd69b90" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_745a293c8b2c750bc421fa06332" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7965db2b12872551b586f76dd79" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_47b6a97e09895a06606a4a80421" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c9b171391d920c279fae8a1bf26" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_636b2ccafeee793bb7edc5a5919" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization"("id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration", "isRemoveIdleTime", "allowScreenshotCapture", "imageId", "upworkOrganizationId", "upworkOrganizationName", "isArchived", "deletedAt", "randomScreenshot", "trackOnSleep", "screenshotFrequency", "enforced", "archivedAt", "standardWorkHoursPerDay", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration", "isRemoveIdleTime", "allowScreenshotCapture", "imageId", "upworkOrganizationId", "upworkOrganizationName", "isArchived", "deletedAt", "randomScreenshot", "trackOnSleep", "screenshotFrequency", "enforced", "archivedAt", "standardWorkHoursPerDay", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays" FROM "temporary_organization"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization"`);
		await queryRunner.query(`CREATE INDEX "IDX_636b2ccafeee793bb7edc5a591" ON "organization" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9b171391d920c279fae8a1bf2" ON "organization" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_47b6a97e09895a06606a4a8042" ON "organization" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7965db2b12872551b586f76dd7" ON "organization" ("contactId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_2360aa7a4b5ab99e026584f305" ON "organization" ("defaultValueDateType") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_15458cef74076623c270500053" ON "organization" ("currency") `);
		await queryRunner.query(`CREATE INDEX "IDX_9ea70bf5c390b00e7bb96b86ed" ON "organization" ("overview") `);
		await queryRunner.query(`CREATE INDEX "IDX_c75285bf286b17c7ca5537857b" ON "organization" ("client_focus") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_f37d866c3326eca5f579cef35c" ON "organization" ("short_description") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_b03a8a28f6ebdb6df8f630216b" ON "organization" ("totalEmployees") `);
		await queryRunner.query(`CREATE INDEX "IDX_6cc2b2052744e352834a4c9e78" ON "organization" ("banner") `);
		await queryRunner.query(`CREATE INDEX "IDX_40460ab803bf6e5a62b75a35c5" ON "organization" ("profile_link") `);
		await queryRunner.query(`CREATE INDEX "IDX_03e5eecc2328eb545ff748cbdd" ON "organization" ("isDefault") `);
		await queryRunner.query(`CREATE INDEX "IDX_c21e615583a3ebbb0977452afb" ON "organization" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_745a293c8b2c750bc421fa0633" ON "organization" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_6de52b8f3de32abee3df2628a3" ON "organization" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b2091c1795f1d0d919b278ab23" ON "organization" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_45db25594e621f1629a9fd69b9" ON "organization" ("updatedByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_47da91256516fc5f08685638fc"`);
		await queryRunner.query(`DROP INDEX "IDX_489012234f53089d4b508f4aa1"`);
		await queryRunner.query(`DROP INDEX "IDX_f44648e75dbfafe2a807bd25df"`);
		await queryRunner.query(`DROP INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf"`);
		await queryRunner.query(`DROP INDEX "IDX_16c34de330ae8d59d9b31cce14"`);
		await queryRunner.query(`DROP INDEX "IDX_a414a803f8de400b689c9a926a"`);
		await queryRunner.query(`DROP INDEX "IDX_904ae0b765faef6ba2db8b1e69"`);
		await queryRunner.query(`DROP INDEX "IDX_3590135ac2034d7aa88efa7e52"`);
		await queryRunner.query(`DROP INDEX "IDX_18e22d4b569159bb91dec869aa"`);
		await queryRunner.query(`DROP INDEX "IDX_bc1e32c13683dbb16ada1c6da1"`);
		await queryRunner.query(`DROP INDEX "IDX_c210effeb6314d325bc024d21e"`);
		await queryRunner.query(`DROP INDEX "IDX_37215da8dee9503d759adb3538"`);
		await queryRunner.query(`DROP INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d"`);
		await queryRunner.query(`DROP INDEX "IDX_7cf84e8b5775f349f81a1f3cc4"`);
		await queryRunner.query(`DROP INDEX "IDX_063324fdceb51f7086e401ed2c"`);
		await queryRunner.query(`DROP INDEX "IDX_75855b44250686f84b7c4bc1f1"`);
		await queryRunner.query(`DROP INDEX "IDX_c5c4366237dc2bb176c1503426"`);
		await queryRunner.query(`DROP INDEX "IDX_3e128d30e9910ff920eee4ef37"`);
		await queryRunner.query(`DROP INDEX "IDX_408532f0a32e4fef8d2684a97f"`);
		await queryRunner.query(`DROP INDEX "IDX_d93ae6f56a3b06ddc69ac5fc2e"`);
		await queryRunner.query(`ALTER TABLE "organization_project" RENAME TO "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE TABLE "organization_project" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "startDate" datetime, "endDate" datetime, "billing" varchar, "currency" varchar, "public" boolean, "owner" varchar, "taskListType" varchar NOT NULL DEFAULT ('GRID'), "code" varchar, "description" varchar, "color" varchar, "billable" boolean, "billingFlat" boolean, "openSource" boolean, "projectUrl" varchar, "openSourceProjectUrl" varchar, "budget" integer, "budgetType" text DEFAULT ('cost'), "organizationContactId" varchar, "membersCount" integer DEFAULT (0), "imageUrl" varchar(500), "imageId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "repositoryId" varchar, "isTasksAutoSync" boolean DEFAULT (1), "isTasksAutoSyncOnLabel" boolean DEFAULT (1), "syncTag" varchar, "deletedAt" datetime, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "icon" varchar, "status" varchar, "archiveTasksIn" decimal, "closeTasksIn" decimal, "defaultAssigneeId" varchar, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_d93ae6f56a3b06ddc69ac5fc2e8" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_408532f0a32e4fef8d2684a97f8" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_7cf84e8b5775f349f81a1f3cc44" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9d8afc1e1e64d4b7d48dd2229d7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_bc1e32c13683dbb16ada1c6da14" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE, CONSTRAINT "FK_904ae0b765faef6ba2db8b1e698" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_489012234f53089d4b508f4aa12" FOREIGN KEY ("defaultAssigneeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_47da91256516fc5f08685638fca" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "organization_project"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "startDate", "endDate", "billing", "currency", "public", "owner", "taskListType", "code", "description", "color", "billable", "billingFlat", "openSource", "projectUrl", "openSourceProjectUrl", "budget", "budgetType", "organizationContactId", "membersCount", "imageUrl", "imageId", "isActive", "isArchived", "repositoryId", "isTasksAutoSync", "isTasksAutoSyncOnLabel", "syncTag", "deletedAt", "fix_relational_custom_fields", "archivedAt", "icon", "status", "archiveTasksIn", "closeTasksIn", "defaultAssigneeId", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_organization_project"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_project"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_47da91256516fc5f08685638fc" ON "organization_project" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_489012234f53089d4b508f4aa1" ON "organization_project" ("defaultAssigneeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f44648e75dbfafe2a807bd25df" ON "organization_project" ("closeTasksIn") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d6e002ae2ed0e1b0c9a52d8acf" ON "organization_project" ("archiveTasksIn") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_16c34de330ae8d59d9b31cce14" ON "organization_project" ("status") `);
		await queryRunner.query(`CREATE INDEX "IDX_a414a803f8de400b689c9a926a" ON "organization_project" ("icon") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_904ae0b765faef6ba2db8b1e69" ON "organization_project" ("repositoryId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_3590135ac2034d7aa88efa7e52" ON "organization_project" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_18e22d4b569159bb91dec869aa" ON "organization_project" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_bc1e32c13683dbb16ada1c6da1" ON "organization_project" ("organizationContactId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c210effeb6314d325bc024d21e" ON "organization_project" ("currency") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_37215da8dee9503d759adb3538" ON "organization_project" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_9d8afc1e1e64d4b7d48dd2229d" ON "organization_project" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7cf84e8b5775f349f81a1f3cc4" ON "organization_project" ("tenantId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_75855b44250686f84b7c4bc1f1" ON "organization_project" ("isTasksAutoSync") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_c5c4366237dc2bb176c1503426" ON "organization_project" ("isTasksAutoSyncOnLabel") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_3e128d30e9910ff920eee4ef37" ON "organization_project" ("syncTag") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_408532f0a32e4fef8d2684a97f" ON "organization_project" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d93ae6f56a3b06ddc69ac5fc2e" ON "organization_project" ("deletedByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_6780bb4a1f9343f762c6453f17"`);
		await queryRunner.query(`DROP INDEX "IDX_71d0299329e15bb40da0e9c55b"`);
		await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
		await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
		await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
		await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
		await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
		await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
		await queryRunner.query(`DROP INDEX "IDX_510cb87f5da169e57e694d1a5c"`);
		await queryRunner.query(`DROP INDEX "IDX_175b7be641928a31521224daa8"`);
		await queryRunner.query(`DROP INDEX "IDX_ddf5990b253db3ec7b33372131"`);
		await queryRunner.query(`ALTER TABLE "employee" RENAME TO "temporary_employee"`);
		await queryRunner.query(
			`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (0), "deletedAt" datetime, "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "upworkId" varchar, "linkedInId" varchar, "isOnline" boolean DEFAULT (0), "isTrackingTime" boolean DEFAULT (0), "minimumBillingRate" integer, "isAway" boolean DEFAULT (0), "isArchived" boolean DEFAULT (0), "fix_relational_custom_fields" boolean, "archivedAt" datetime, "allowManualTime" boolean NOT NULL DEFAULT (0), "allowModifyTime" boolean NOT NULL DEFAULT (0), "allowDeleteTime" boolean NOT NULL DEFAULT (0), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "allowAgentAppExit" boolean NOT NULL DEFAULT (1), "allowLogoutFromAgentApp" boolean NOT NULL DEFAULT (1), "trackKeyboardMouseActivity" boolean NOT NULL DEFAULT (0), "trackAllDisplays" boolean NOT NULL DEFAULT (0), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "FK_ddf5990b253db3ec7b333721312" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_71d0299329e15bb40da0e9c55b1" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6780bb4a1f9343f762c6453f175" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt", "allowManualTime", "allowModifyTime", "allowDeleteTime", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt", "allowManualTime", "allowModifyTime", "allowDeleteTime", "createdByUserId", "updatedByUserId", "deletedByUserId", "allowAgentAppExit", "allowLogoutFromAgentApp", "trackKeyboardMouseActivity", "trackAllDisplays" FROM "temporary_employee"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee"`);
		await queryRunner.query(`CREATE INDEX "IDX_6780bb4a1f9343f762c6453f17" ON "employee" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_71d0299329e15bb40da0e9c55b" ON "employee" ("createdByUserId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
		await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
		await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_510cb87f5da169e57e694d1a5c" ON "employee" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_175b7be641928a31521224daa8" ON "employee" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ddf5990b253db3ec7b33372131" ON "employee" ("updatedByUserId") `);
		await queryRunner.query(`DROP INDEX "IDX_9c7a67d94dc7edfc580657a52d"`);
		await queryRunner.query(`DROP INDEX "IDX_31cca01b2ea11308a44475563b"`);
		await queryRunner.query(`DROP TABLE "plugin_subscriptions_closure"`);
		await queryRunner.query(`DROP INDEX "IDX_ac6e3a024785d6cd7e1dc8a7d0"`);
		await queryRunner.query(`DROP INDEX "IDX_6eca05af711ef729dbe99f9b63"`);
		await queryRunner.query(`DROP TABLE "plugin_categories_closure"`);
		await queryRunner.query(`DROP INDEX "IDX_17fc7d5ec9f51d9716c79b50ae"`);
		await queryRunner.query(`DROP INDEX "IDX_27e45daf821a522cf6c7b794bc"`);
		await queryRunner.query(`DROP TABLE "plugin_tenant_denied_users"`);
		await queryRunner.query(`DROP INDEX "IDX_99cab633947d311b29e5e3d9f1"`);
		await queryRunner.query(`DROP INDEX "IDX_358b3ee7d6cac92234c829e384"`);
		await queryRunner.query(`DROP TABLE "plugin_tenant_allowed_users"`);
		await queryRunner.query(`DROP INDEX "IDX_0c355caddd182f2e7099d35911"`);
		await queryRunner.query(`DROP INDEX "IDX_12c6c6c88720dfb785a0e066bb"`);
		await queryRunner.query(`DROP TABLE "plugin_tenant_allowed_roles"`);
		await queryRunner.query(`DROP INDEX "IDX_7d05232ee38835a76623154b7b"`);
		await queryRunner.query(`DROP INDEX "IDX_7b12d1d4e5d36737596155ce2d"`);
		await queryRunner.query(`DROP INDEX "IDX_9e3344b0c59fcd4cd699cef727"`);
		await queryRunner.query(`DROP INDEX "IDX_e1d678ee40f241203ee5ad7d41"`);
		await queryRunner.query(`DROP INDEX "IDX_8fb8bf376857199096a73d90b8"`);
		await queryRunner.query(`DROP INDEX "IDX_2c926e12d6fba9b0d320c974f3"`);
		await queryRunner.query(`DROP INDEX "IDX_74d0d8f22af90d92d3213d5e74"`);
		await queryRunner.query(`DROP TABLE "plugin_billings"`);
		await queryRunner.query(`DROP INDEX "IDX_eb3b9c7cfe7aa86bca589aee9e"`);
		await queryRunner.query(`DROP INDEX "IDX_af82eaa17a59e0cf0fac16d7fe"`);
		await queryRunner.query(`DROP INDEX "IDX_fed0c61e1d142e1c448a45e5a0"`);
		await queryRunner.query(`DROP INDEX "IDX_448990d16086477ee1c5f08968"`);
		await queryRunner.query(`DROP INDEX "IDX_18db53b62833e1bdb9949b5827"`);
		await queryRunner.query(`DROP INDEX "IDX_4e8a9f4ee7df8c39d0314063e7"`);
		await queryRunner.query(`DROP INDEX "IDX_bbd6dc08c0c91724e5d26202fa"`);
		await queryRunner.query(`DROP INDEX "IDX_39a16aca760fc7a3cef39d5563"`);
		await queryRunner.query(`DROP INDEX "IDX_7afeffe18364cae48efd454e4d"`);
		await queryRunner.query(`DROP INDEX "IDX_9bbac226cce476576134c5726e"`);
		await queryRunner.query(`DROP INDEX "IDX_7f792e3c1891f728f9e5256142"`);
		await queryRunner.query(`DROP INDEX "IDX_b5163f874ce5bc6b63c8e8631a"`);
		await queryRunner.query(`DROP INDEX "IDX_18743cb5933b78e2b8081589e4"`);
		await queryRunner.query(`DROP INDEX "IDX_0be98c36cdbaa56f3880bc6baa"`);
		await queryRunner.query(`DROP INDEX "IDX_ddf7be116060ee20bc16128632"`);
		await queryRunner.query(`DROP INDEX "IDX_449b2294593f5787f40a60c8f2"`);
		await queryRunner.query(`DROP TABLE "plugin_subscriptions"`);
		await queryRunner.query(`DROP INDEX "IDX_082f6cba880ecd144b28284376"`);
		await queryRunner.query(`DROP INDEX "IDX_37c9e1c698331b9345280374fd"`);
		await queryRunner.query(`DROP INDEX "IDX_234c8f3d694ae31b095bdf5a8a"`);
		await queryRunner.query(`DROP INDEX "IDX_dec9037a57726ae5f54bc3c4a8"`);
		await queryRunner.query(`DROP INDEX "IDX_a7bf8b446ca66e5824fb6ff91a"`);
		await queryRunner.query(`DROP INDEX "IDX_6f401b811d14d8b06db0fbea30"`);
		await queryRunner.query(`DROP INDEX "IDX_b874f9ee9c04061b4892926388"`);
		await queryRunner.query(`DROP INDEX "IDX_646aa1161ac9861061842e05c2"`);
		await queryRunner.query(`DROP TABLE "plugin_subscription_plans"`);
		await queryRunner.query(`DROP INDEX "IDX_0479844f05c1132f8929cab1c8"`);
		await queryRunner.query(`DROP INDEX "IDX_6c8d4a0f437cfae296ef43ce13"`);
		await queryRunner.query(`DROP INDEX "IDX_c0fab3c6709a93bca88eb100a9"`);
		await queryRunner.query(`DROP INDEX "IDX_123f1b37f4826f6241446a8416"`);
		await queryRunner.query(`DROP INDEX "IDX_15ca158f27ab3296915b7d1b38"`);
		await queryRunner.query(`DROP INDEX "IDX_4bf89f98c41969e23e3f9974d5"`);
		await queryRunner.query(`DROP INDEX "IDX_16d0aed6fcc311379f5c75bbd2"`);
		await queryRunner.query(`DROP INDEX "IDX_100eef6409ee96d0673ee510e6"`);
		await queryRunner.query(`DROP INDEX "IDX_35ee1cb5098e17e30ee5cbc705"`);
		await queryRunner.query(`DROP INDEX "IDX_c61c7032e7b3afd352d82bc4b4"`);
		await queryRunner.query(`DROP INDEX "IDX_d0a1444aa92229d7f1af237184"`);
		await queryRunner.query(`DROP INDEX "IDX_3210c015451d02d015a23eedad"`);
		await queryRunner.query(`DROP INDEX "IDX_61357761fc6b140180b104dc8d"`);
		await queryRunner.query(`DROP INDEX "IDX_cc5b64091fbfdcdbd23d6da80e"`);
		await queryRunner.query(`DROP TABLE "plugins"`);
		await queryRunner.query(`DROP INDEX "IDX_39d060301c8a36b51da6e4aec3"`);
		await queryRunner.query(`DROP INDEX "IDX_f5c8259c0d815486f31878864d"`);
		await queryRunner.query(`DROP INDEX "IDX_e1e7cf1589d06ac02a12e41db0"`);
		await queryRunner.query(`DROP INDEX "IDX_e632aa70ea7b7e5c5fdbfba41b"`);
		await queryRunner.query(`DROP INDEX "IDX_6fa0eda3add1fb070ba172a44e"`);
		await queryRunner.query(`DROP INDEX "IDX_8adf7a9181e968bcafc71236c8"`);
		await queryRunner.query(`DROP INDEX "IDX_ab6e29cd444226f80bf0c0c1db"`);
		await queryRunner.query(`DROP INDEX "IDX_f806bae81cd490404a1888ad5b"`);
		await queryRunner.query(`DROP INDEX "IDX_650ccf2e7394509f7ad8448e32"`);
		await queryRunner.query(`DROP INDEX "IDX_a16869769b9a219acb157bb2b3"`);
		await queryRunner.query(`DROP INDEX "IDX_e6d49799b916946e5cd5399385"`);
		await queryRunner.query(`DROP INDEX "IDX_e06094816e67e584dea754cc81"`);
		await queryRunner.query(`DROP INDEX "IDX_0b36b5701e9890a395ded76cb5"`);
		await queryRunner.query(`DROP INDEX "IDX_485db4d1cc977cc3d499824d95"`);
		await queryRunner.query(`DROP TABLE "plugin_versions"`);
		await queryRunner.query(`DROP INDEX "IDX_6fae6d0ddfd7177abcb4befd72"`);
		await queryRunner.query(`DROP INDEX "IDX_af8978fbf37560525c19ec7048"`);
		await queryRunner.query(`DROP INDEX "IDX_d658bc853b354445cf2a0d6fb7"`);
		await queryRunner.query(`DROP INDEX "IDX_55bee446d2c470e5d6b066a27a"`);
		await queryRunner.query(`DROP INDEX "IDX_7c6dc1cdd58690b7179d76184b"`);
		await queryRunner.query(`DROP INDEX "IDX_19d9135639e3b40ec0dca1c926"`);
		await queryRunner.query(`DROP INDEX "IDX_0ab83b39cc676ee2097714fb3b"`);
		await queryRunner.query(`DROP INDEX "IDX_cb9a1e5640b8e07a9a63b51245"`);
		await queryRunner.query(`DROP INDEX "IDX_c90b796bd033e54e3719213a0c"`);
		await queryRunner.query(`DROP INDEX "IDX_0404416b5c1cd48ae87fe81834"`);
		await queryRunner.query(`DROP INDEX "IDX_09a383d6f2858d49c064ca4cda"`);
		await queryRunner.query(`DROP TABLE "plugin_sources"`);
		await queryRunner.query(`DROP INDEX "IDX_1569d8ca526d958d82483e15c7"`);
		await queryRunner.query(`DROP INDEX "IDX_173e0668b17afd3696abf3c518"`);
		await queryRunner.query(`DROP INDEX "IDX_3c3ce338e7716d853220d8b176"`);
		await queryRunner.query(`DROP INDEX "IDX_5e6b80341a4ed75ae7c4af6897"`);
		await queryRunner.query(`DROP INDEX "IDX_c92ea21dfcfd889730e2214c8f"`);
		await queryRunner.query(`DROP INDEX "IDX_28624735b4e3ace75883521a57"`);
		await queryRunner.query(`DROP INDEX "IDX_32c3f7a738ec8b40d6375b2933"`);
		await queryRunner.query(`DROP INDEX "IDX_acac58b213936ea488d0a8d1a3"`);
		await queryRunner.query(`DROP INDEX "IDX_547e4b71ae81ee772fa4ab79e6"`);
		await queryRunner.query(`DROP INDEX "IDX_8aafffefdce2eb11079ec2aa75"`);
		await queryRunner.query(`DROP INDEX "IDX_dff9e6c763c8c33b07f330e6a1"`);
		await queryRunner.query(`DROP INDEX "IDX_3e63eed07bcc0e3e36d9183cca"`);
		await queryRunner.query(`DROP INDEX "IDX_d742ed346264f4c9d9225265d7"`);
		await queryRunner.query(`DROP INDEX "IDX_a45f5c2aba22d4fa4eb8fa85af"`);
		await queryRunner.query(`DROP INDEX "IDX_7e9b8b3eebb881753e07b73f6c"`);
		await queryRunner.query(`DROP INDEX "IDX_842e5e5f94c4008a42d4b5f44a"`);
		await queryRunner.query(`DROP TABLE "plugin_installations"`);
		await queryRunner.query(`DROP INDEX "IDX_676e7c749905331c36b1707ba8"`);
		await queryRunner.query(`DROP INDEX "IDX_cddb5e04a93a957dc4d56522b7"`);
		await queryRunner.query(`DROP INDEX "IDX_17c923b300710a13f6dfade59b"`);
		await queryRunner.query(`DROP INDEX "IDX_df3d0fc648c9e0544ca11df9d2"`);
		await queryRunner.query(`DROP INDEX "IDX_05292c8750270ff028ab2fec14"`);
		await queryRunner.query(`DROP INDEX "IDX_8bcd0243b780191a391b348f58"`);
		await queryRunner.query(`DROP INDEX "IDX_da359f059e06030ec33adba133"`);
		await queryRunner.query(`DROP INDEX "IDX_cacbb5fd767b06985be6049858"`);
		await queryRunner.query(`DROP INDEX "IDX_fe4db46e2c3d32f64b4a4728e3"`);
		await queryRunner.query(`DROP INDEX "IDX_09654ebaec00e0c0c4dfae4c42"`);
		await queryRunner.query(`DROP INDEX "IDX_ee480ffb800fb2c9f6d91f66aa"`);
		await queryRunner.query(`DROP INDEX "IDX_9b013a85a6ae26db17101ffb89"`);
		await queryRunner.query(`DROP TABLE "plugin_tags"`);
		await queryRunner.query(`DROP INDEX "IDX_ca31918911db08a4008be72c8e"`);
		await queryRunner.query(`DROP INDEX "IDX_7c239f665e5caedd708c62b1f7"`);
		await queryRunner.query(`DROP INDEX "IDX_b23665ef0d73dbe47d4d26f3d5"`);
		await queryRunner.query(`DROP INDEX "IDX_99ab190a6b7ae5ffc61b4dfaf4"`);
		await queryRunner.query(`DROP INDEX "IDX_1fa4520b20a0bf4fdfe3ca1ec7"`);
		await queryRunner.query(`DROP INDEX "IDX_c7c4b6b97be418be173859d10d"`);
		await queryRunner.query(`DROP INDEX "IDX_60543808734ff13850d7843f7b"`);
		await queryRunner.query(`DROP TABLE "plugin_categories"`);
		await queryRunner.query(`DROP INDEX "IDX_48aa394150a960cf3e7b285cf4"`);
		await queryRunner.query(`DROP INDEX "IDX_734649a34ee071f44de4a14490"`);
		await queryRunner.query(`DROP INDEX "IDX_a8471a91f63494a0d3ec5cf248"`);
		await queryRunner.query(`DROP INDEX "IDX_8e11188fb92db2ee126b53e866"`);
		await queryRunner.query(`DROP INDEX "IDX_737e0935140d7b17632fc7815a"`);
		await queryRunner.query(`DROP INDEX "IDX_d4504369b0f19d2360a464408a"`);
		await queryRunner.query(`DROP INDEX "IDX_bbced9536ca0a8ee967b531c32"`);
		await queryRunner.query(`DROP INDEX "IDX_199b3708ea7962d21fc55de243"`);
		await queryRunner.query(`DROP INDEX "IDX_cf20745f234b0b3512c03d74be"`);
		await queryRunner.query(`DROP INDEX "IDX_a97ab238dc6aff5f305d37dbc7"`);
		await queryRunner.query(`DROP INDEX "IDX_6b8deef29d0fb5eee571c39b39"`);
		await queryRunner.query(`DROP INDEX "IDX_5534e36ff3a1416c17f507d546"`);
		await queryRunner.query(`DROP TABLE "plugin_settings"`);
		await queryRunner.query(`DROP INDEX "IDX_1394aebfcfe6782051e76f46a5"`);
		await queryRunner.query(`DROP INDEX "IDX_a3a616a07b21a4212736493f5e"`);
		await queryRunner.query(`DROP INDEX "IDX_69f72957e1c98832cdab0c486e"`);
		await queryRunner.query(`DROP INDEX "IDX_4f1dada611375594ce22411cbe"`);
		await queryRunner.query(`DROP INDEX "IDX_52ca2ab9f943fe3f47df36aef7"`);
		await queryRunner.query(`DROP INDEX "IDX_a32259b1b9cdeea1c6d94bf94c"`);
		await queryRunner.query(`DROP INDEX "IDX_1aca41d7ee08b3b140eae4ee88"`);
		await queryRunner.query(`DROP INDEX "IDX_c4accce384c6007c92b9afdc2d"`);
		await queryRunner.query(`DROP INDEX "IDX_e723cb5fdc4092538fe0384853"`);
		await queryRunner.query(`DROP INDEX "IDX_6d6a338f4eb5b467c2ff5eaa4b"`);
		await queryRunner.query(`DROP INDEX "IDX_c47db2e2072ba3b57060819246"`);
		await queryRunner.query(`DROP INDEX "IDX_545faee53386f4e9d7b4311104"`);
		await queryRunner.query(`DROP INDEX "IDX_5df2b63d82f2168e43c2d7e64c"`);
		await queryRunner.query(`DROP INDEX "IDX_0ed7c977facb534e572d33b485"`);
		await queryRunner.query(`DROP INDEX "IDX_cf185e176c869e2be48d00d648"`);
		await queryRunner.query(`DROP INDEX "IDX_06f10073cd6e84a19b6f604ddd"`);
		await queryRunner.query(`DROP INDEX "IDX_0b5cc71673410a449491fb3db9"`);
		await queryRunner.query(`DROP INDEX "IDX_f209a8620f1677ed2c82c4cd2e"`);
		await queryRunner.query(`DROP TABLE "plugin_tenants"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_tenants\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`pluginId\` varchar(255) NOT NULL, \`enabled\` tinyint NOT NULL DEFAULT 1, \`scope\` enum ('tenant', 'organization', 'user') NOT NULL DEFAULT 'user', \`autoInstall\` tinyint NOT NULL DEFAULT 0, \`requiresApproval\` tinyint NOT NULL DEFAULT 1, \`isMandatory\` tinyint NOT NULL DEFAULT 0, \`maxInstallations\` int NULL, \`maxActiveUsers\` int NULL, \`currentInstallations\` int NOT NULL DEFAULT '0', \`currentActiveUsers\` int NOT NULL DEFAULT '0', \`tenantConfiguration\` json NULL, \`preferences\` json NULL, \`approvedAt\` timestamp NULL, \`isDataCompliant\` tinyint NOT NULL DEFAULT 1, \`complianceCertifications\` text NULL, \`approvedById\` varchar(255) NULL, INDEX \`IDX_f209a8620f1677ed2c82c4cd2e\` (\`createdByUserId\`), INDEX \`IDX_0b5cc71673410a449491fb3db9\` (\`updatedByUserId\`), INDEX \`IDX_06f10073cd6e84a19b6f604ddd\` (\`deletedByUserId\`), INDEX \`IDX_cf185e176c869e2be48d00d648\` (\`isActive\`), INDEX \`IDX_0ed7c977facb534e572d33b485\` (\`isArchived\`), INDEX \`IDX_5df2b63d82f2168e43c2d7e64c\` (\`tenantId\`), INDEX \`IDX_545faee53386f4e9d7b4311104\` (\`organizationId\`), INDEX \`IDX_c47db2e2072ba3b57060819246\` (\`pluginId\`), INDEX \`IDX_6d6a338f4eb5b467c2ff5eaa4b\` (\`enabled\`), INDEX \`IDX_e723cb5fdc4092538fe0384853\` (\`scope\`), INDEX \`IDX_c4accce384c6007c92b9afdc2d\` (\`currentInstallations\`), INDEX \`IDX_1aca41d7ee08b3b140eae4ee88\` (\`currentActiveUsers\`), INDEX \`IDX_a32259b1b9cdeea1c6d94bf94c\` (\`approvedAt\`), INDEX \`IDX_52ca2ab9f943fe3f47df36aef7\` (\`approvedById\`), INDEX \`IDX_4f1dada611375594ce22411cbe\` (\`pluginId\`, \`enabled\`), INDEX \`IDX_69f72957e1c98832cdab0c486e\` (\`organizationId\`, \`scope\`), INDEX \`IDX_a3a616a07b21a4212736493f5e\` (\`tenantId\`, \`scope\`, \`enabled\`), UNIQUE INDEX \`IDX_1394aebfcfe6782051e76f46a5\` (\`pluginId\`, \`tenantId\`, \`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_settings\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`key\` varchar(255) NOT NULL, \`value\` text NOT NULL, \`isRequired\` tinyint NOT NULL DEFAULT 0, \`isEncrypted\` tinyint NOT NULL DEFAULT 0, \`description\` text NULL, \`order\` int NULL, \`validationRules\` text NULL, \`dataType\` enum ('string', 'number', 'boolean', 'json', 'file') NOT NULL DEFAULT 'string', \`defaultValue\` varchar(255) NULL, \`pluginId\` varchar(255) NOT NULL, \`pluginTenantId\` varchar(255) NULL, \`categoryId\` varchar(255) NULL, \`updatedById\` varchar(255) NULL, INDEX \`IDX_5534e36ff3a1416c17f507d546\` (\`createdByUserId\`), INDEX \`IDX_6b8deef29d0fb5eee571c39b39\` (\`updatedByUserId\`), INDEX \`IDX_a97ab238dc6aff5f305d37dbc7\` (\`deletedByUserId\`), INDEX \`IDX_cf20745f234b0b3512c03d74be\` (\`isActive\`), INDEX \`IDX_199b3708ea7962d21fc55de243\` (\`isArchived\`), INDEX \`IDX_bbced9536ca0a8ee967b531c32\` (\`tenantId\`), INDEX \`IDX_d4504369b0f19d2360a464408a\` (\`organizationId\`), INDEX \`IDX_737e0935140d7b17632fc7815a\` (\`pluginId\`), INDEX \`IDX_8e11188fb92db2ee126b53e866\` (\`pluginTenantId\`), INDEX \`IDX_a8471a91f63494a0d3ec5cf248\` (\`categoryId\`), INDEX \`IDX_734649a34ee071f44de4a14490\` (\`updatedById\`), UNIQUE INDEX \`IDX_48aa394150a960cf3e7b285cf4\` (\`pluginId\`, \`key\`, \`pluginTenantId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_categories\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`name\` varchar(255) NOT NULL, \`description\` text NULL, \`slug\` varchar(255) NOT NULL, \`color\` varchar(255) NULL, \`icon\` varchar(255) NULL, \`order\` int NOT NULL DEFAULT '0', \`metadata\` json NULL, \`parentId\` varchar(255) NULL, INDEX \`IDX_60543808734ff13850d7843f7b\` (\`createdByUserId\`), INDEX \`IDX_c7c4b6b97be418be173859d10d\` (\`updatedByUserId\`), INDEX \`IDX_1fa4520b20a0bf4fdfe3ca1ec7\` (\`deletedByUserId\`), INDEX \`IDX_99ab190a6b7ae5ffc61b4dfaf4\` (\`isActive\`), INDEX \`IDX_b23665ef0d73dbe47d4d26f3d5\` (\`isArchived\`), INDEX \`IDX_7c239f665e5caedd708c62b1f7\` (\`tenantId\`), INDEX \`IDX_ca31918911db08a4008be72c8e\` (\`organizationId\`), UNIQUE INDEX \`IDX_d427c34c4dd721c72d5d56187f\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_tags\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`pluginId\` varchar(255) NOT NULL, \`tagId\` varchar(255) NOT NULL, \`appliedAt\` timestamp NULL DEFAULT CURRENT_TIMESTAMP, \`appliedById\` varchar(255) NULL, \`priority\` int NULL COMMENT 'Priority weight for tag association (0-100, higher = more important)' DEFAULT '50', \`isFeatured\` tinyint NOT NULL COMMENT 'Indicates if this tag association should be featured/highlighted' DEFAULT 0, INDEX \`IDX_9b013a85a6ae26db17101ffb89\` (\`createdByUserId\`), INDEX \`IDX_ee480ffb800fb2c9f6d91f66aa\` (\`updatedByUserId\`), INDEX \`IDX_09654ebaec00e0c0c4dfae4c42\` (\`deletedByUserId\`), INDEX \`IDX_fe4db46e2c3d32f64b4a4728e3\` (\`isActive\`), INDEX \`IDX_cacbb5fd767b06985be6049858\` (\`isArchived\`), INDEX \`IDX_da359f059e06030ec33adba133\` (\`tenantId\`), INDEX \`IDX_8bcd0243b780191a391b348f58\` (\`organizationId\`), INDEX \`IDX_05292c8750270ff028ab2fec14\` (\`pluginId\`), INDEX \`IDX_df3d0fc648c9e0544ca11df9d2\` (\`tagId\`), INDEX \`IDX_17c923b300710a13f6dfade59b\` (\`tagId\`, \`tenantId\`, \`organizationId\`), INDEX \`IDX_cddb5e04a93a957dc4d56522b7\` (\`pluginId\`, \`tenantId\`, \`organizationId\`), UNIQUE INDEX \`IDX_676e7c749905331c36b1707ba8\` (\`pluginId\`, \`tagId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_installations\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`pluginId\` varchar(36) NULL, \`versionId\` varchar(36) NULL, \`installedById\` varchar(36) NULL, \`installedAt\` datetime NULL, \`uninstalledAt\` datetime NULL, \`status\` enum ('INSTALLED', 'UNINSTALLED', 'FAILED', 'IN_PROGRESS') NOT NULL DEFAULT 'IN_PROGRESS', \`isActivated\` tinyint NOT NULL DEFAULT 0, \`activatedAt\` datetime NULL, \`deactivatedAt\` datetime NULL, INDEX \`IDX_842e5e5f94c4008a42d4b5f44a\` (\`createdByUserId\`), INDEX \`IDX_7e9b8b3eebb881753e07b73f6c\` (\`updatedByUserId\`), INDEX \`IDX_a45f5c2aba22d4fa4eb8fa85af\` (\`deletedByUserId\`), INDEX \`IDX_d742ed346264f4c9d9225265d7\` (\`isActive\`), INDEX \`IDX_3e63eed07bcc0e3e36d9183cca\` (\`isArchived\`), INDEX \`IDX_dff9e6c763c8c33b07f330e6a1\` (\`tenantId\`), INDEX \`IDX_8aafffefdce2eb11079ec2aa75\` (\`organizationId\`), INDEX \`IDX_547e4b71ae81ee772fa4ab79e6\` (\`pluginId\`), INDEX \`IDX_acac58b213936ea488d0a8d1a3\` (\`versionId\`), INDEX \`IDX_32c3f7a738ec8b40d6375b2933\` (\`installedById\`), INDEX \`IDX_28624735b4e3ace75883521a57\` (\`installedAt\`), INDEX \`IDX_c92ea21dfcfd889730e2214c8f\` (\`uninstalledAt\`), INDEX \`IDX_5e6b80341a4ed75ae7c4af6897\` (\`activatedAt\`), INDEX \`IDX_3c3ce338e7716d853220d8b176\` (\`deactivatedAt\`), INDEX \`IDX_173e0668b17afd3696abf3c518\` (\`installedById\`, \`pluginId\`), UNIQUE INDEX \`IDX_1569d8ca526d958d82483e15c7\` (\`pluginId\`, \`tenantId\`, \`organizationId\`, \`installedById\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_sources\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`type\` enum ('CDN', 'NPM', 'GAUZY') NOT NULL DEFAULT 'GAUZY', \`operatingSystem\` enum ('LINUX', 'MAC', 'WINDOWS', 'UNIVERSAL') NOT NULL DEFAULT 'UNIVERSAL', \`architecture\` enum ('X64', 'ARM') NOT NULL DEFAULT 'X64', \`url\` varchar(255) NULL, \`integrity\` varchar(255) NULL, \`crossOrigin\` varchar(255) NULL, \`name\` varchar(255) NULL, \`registry\` varchar(255) NULL, \`private\` tinyint NULL DEFAULT 0, \`scope\` varchar(255) NULL, \`filePath\` varchar(255) NULL, \`fileName\` varchar(255) NULL, \`fileSize\` int NULL, \`mimeType\` varchar(255) NULL, \`fileKey\` varchar(255) NULL, \`versionId\` varchar(255) NULL, \`storageProvider\` enum ('LOCAL', 'S3', 'WASABI', 'CLOUDINARY', 'DIGITALOCEAN') NULL, INDEX \`IDX_09a383d6f2858d49c064ca4cda\` (\`createdByUserId\`), INDEX \`IDX_0404416b5c1cd48ae87fe81834\` (\`updatedByUserId\`), INDEX \`IDX_c90b796bd033e54e3719213a0c\` (\`deletedByUserId\`), INDEX \`IDX_cb9a1e5640b8e07a9a63b51245\` (\`isActive\`), INDEX \`IDX_0ab83b39cc676ee2097714fb3b\` (\`isArchived\`), INDEX \`IDX_19d9135639e3b40ec0dca1c926\` (\`tenantId\`), INDEX \`IDX_7c6dc1cdd58690b7179d76184b\` (\`organizationId\`), INDEX \`IDX_55bee446d2c470e5d6b066a27a\` (\`versionId\`), INDEX \`IDX_d658bc853b354445cf2a0d6fb7\` (\`storageProvider\`), INDEX \`IDX_af8978fbf37560525c19ec7048\` (\`tenantId\`, \`organizationId\`), UNIQUE INDEX \`IDX_6fae6d0ddfd7177abcb4befd72\` (\`versionId\`, \`operatingSystem\`, \`architecture\`, \`tenantId\`, \`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_versions\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`number\` varchar(255) NOT NULL, \`changelog\` varchar(255) NOT NULL, \`checksum\` varchar(255) NULL, \`signature\` varchar(255) NULL, \`releaseDate\` datetime NULL, \`downloadCount\` int NULL DEFAULT '0', \`pluginId\` varchar(255) NULL, INDEX \`IDX_485db4d1cc977cc3d499824d95\` (\`createdByUserId\`), INDEX \`IDX_0b36b5701e9890a395ded76cb5\` (\`updatedByUserId\`), INDEX \`IDX_e06094816e67e584dea754cc81\` (\`deletedByUserId\`), INDEX \`IDX_e6d49799b916946e5cd5399385\` (\`isActive\`), INDEX \`IDX_a16869769b9a219acb157bb2b3\` (\`isArchived\`), INDEX \`IDX_650ccf2e7394509f7ad8448e32\` (\`tenantId\`), INDEX \`IDX_f806bae81cd490404a1888ad5b\` (\`organizationId\`), INDEX \`IDX_ab6e29cd444226f80bf0c0c1db\` (\`releaseDate\`), INDEX \`IDX_8adf7a9181e968bcafc71236c8\` (\`pluginId\`), INDEX \`IDX_6fa0eda3add1fb070ba172a44e\` (\`downloadCount\`), INDEX \`IDX_e632aa70ea7b7e5c5fdbfba41b\` (\`number\`), INDEX \`IDX_e1e7cf1589d06ac02a12e41db0\` (\`pluginId\`, \`releaseDate\`), INDEX \`IDX_f5c8259c0d815486f31878864d\` (\`tenantId\`, \`organizationId\`), UNIQUE INDEX \`IDX_39d060301c8a36b51da6e4aec3\` (\`pluginId\`, \`organizationId\`, \`number\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugins\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`name\` varchar(255) NOT NULL, \`description\` varchar(255) NULL, \`type\` enum ('DESKTOP', 'WEB', 'MOBILE') NOT NULL DEFAULT 'DESKTOP', \`status\` enum ('ACTIVE', 'INACTIVE', 'DEPRECATED', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE', \`categoryId\` varchar(255) NULL, \`author\` varchar(255) NULL, \`license\` varchar(255) NULL, \`homepage\` varchar(255) NULL, \`repository\` varchar(255) NULL, \`uploadedById\` varchar(255) NULL, \`uploadedAt\` datetime NULL, \`requiresSubscription\` tinyint NOT NULL DEFAULT 0, \`isFeatured\` tinyint NOT NULL DEFAULT 0, \`isVerified\` tinyint NOT NULL DEFAULT 0, \`lastDownloadedAt\` datetime NULL, INDEX \`IDX_cc5b64091fbfdcdbd23d6da80e\` (\`createdByUserId\`), INDEX \`IDX_61357761fc6b140180b104dc8d\` (\`updatedByUserId\`), INDEX \`IDX_3210c015451d02d015a23eedad\` (\`deletedByUserId\`), INDEX \`IDX_d0a1444aa92229d7f1af237184\` (\`isActive\`), INDEX \`IDX_c61c7032e7b3afd352d82bc4b4\` (\`isArchived\`), INDEX \`IDX_35ee1cb5098e17e30ee5cbc705\` (\`type\`), INDEX \`IDX_100eef6409ee96d0673ee510e6\` (\`status\`), INDEX \`IDX_16d0aed6fcc311379f5c75bbd2\` (\`categoryId\`), INDEX \`IDX_4bf89f98c41969e23e3f9974d5\` (\`uploadedById\`), INDEX \`IDX_15ca158f27ab3296915b7d1b38\` (\`isFeatured\`), INDEX \`IDX_123f1b37f4826f6241446a8416\` (\`isVerified\`), INDEX \`IDX_c0fab3c6709a93bca88eb100a9\` (\`status\`, \`isFeatured\`), INDEX \`IDX_6c8d4a0f437cfae296ef43ce13\` (\`status\`, \`type\`), UNIQUE INDEX \`IDX_0479844f05c1132f8929cab1c8\` (\`name\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_subscription_plans\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`name\` varchar(255) NOT NULL, \`description\` text NULL, \`type\` enum ('free', 'trial', 'basic', 'premium', 'enterprise', 'custom') NOT NULL DEFAULT 'free', \`price\` decimal(10,2) NOT NULL DEFAULT '0.00', \`currency\` varchar(3) NOT NULL DEFAULT 'USD', \`billingPeriod\` enum ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one-time') NOT NULL DEFAULT 'monthly', \`features\` text NOT NULL, \`limitations\` json NULL, \`isPopular\` tinyint NOT NULL DEFAULT 0, \`isRecommended\` tinyint NOT NULL DEFAULT 0, \`trialDays\` int NULL, \`setupFee\` decimal(10,2) NULL, \`discountPercentage\` decimal(5,2) NULL, \`metadata\` json NULL, \`sortOrder\` int NOT NULL DEFAULT '0', \`pluginId\` varchar(255) NOT NULL, \`createdById\` varchar(255) NULL, INDEX \`IDX_646aa1161ac9861061842e05c2\` (\`createdByUserId\`), INDEX \`IDX_b874f9ee9c04061b4892926388\` (\`updatedByUserId\`), INDEX \`IDX_6f401b811d14d8b06db0fbea30\` (\`deletedByUserId\`), INDEX \`IDX_a7bf8b446ca66e5824fb6ff91a\` (\`isActive\`), INDEX \`IDX_dec9037a57726ae5f54bc3c4a8\` (\`isArchived\`), INDEX \`IDX_234c8f3d694ae31b095bdf5a8a\` (\`price\`, \`billingPeriod\`), INDEX \`IDX_37c9e1c698331b9345280374fd\` (\`isActive\`, \`type\`), INDEX \`IDX_082f6cba880ecd144b28284376\` (\`pluginId\`, \`type\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_subscriptions\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`status\` enum ('active', 'cancelled', 'expired', 'trial', 'past_due', 'suspended', 'pending') NOT NULL DEFAULT 'pending', \`scope\` enum ('tenant', 'organization', 'user') NOT NULL DEFAULT 'tenant', \`startDate\` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, \`endDate\` datetime NULL, \`trialEndDate\` datetime NULL, \`autoRenew\` tinyint NOT NULL DEFAULT 1, \`cancelledAt\` datetime NULL, \`cancellationReason\` text NULL, \`metadata\` json NULL, \`externalSubscriptionId\` varchar(255) NULL, \`pluginId\` varchar(255) NOT NULL, \`pluginTenantId\` varchar(255) NOT NULL, \`planId\` varchar(255) NULL, \`subscriberId\` varchar(255) NULL, \`parentId\` varchar(255) NULL, INDEX \`IDX_449b2294593f5787f40a60c8f2\` (\`createdByUserId\`), INDEX \`IDX_ddf7be116060ee20bc16128632\` (\`updatedByUserId\`), INDEX \`IDX_0be98c36cdbaa56f3880bc6baa\` (\`deletedByUserId\`), INDEX \`IDX_18743cb5933b78e2b8081589e4\` (\`isActive\`), INDEX \`IDX_b5163f874ce5bc6b63c8e8631a\` (\`isArchived\`), INDEX \`IDX_7f792e3c1891f728f9e5256142\` (\`tenantId\`), INDEX \`IDX_9bbac226cce476576134c5726e\` (\`organizationId\`), INDEX \`IDX_7afeffe18364cae48efd454e4d\` (\`scope\`, \`tenantId\`), INDEX \`IDX_39a16aca760fc7a3cef39d5563\` (\`parentId\`), INDEX \`IDX_bbd6dc08c0c91724e5d26202fa\` (\`externalSubscriptionId\`), INDEX \`IDX_4e8a9f4ee7df8c39d0314063e7\` (\`planId\`), UNIQUE INDEX \`IDX_18db53b62833e1bdb9949b5827\` (\`pluginId\`, \`subscriberId\`, \`tenantId\`), INDEX \`IDX_448990d16086477ee1c5f08968\` (\`status\`, \`tenantId\`), INDEX \`IDX_fed0c61e1d142e1c448a45e5a0\` (\`status\`, \`endDate\`), INDEX \`IDX_af82eaa17a59e0cf0fac16d7fe\` (\`subscriberId\`, \`tenantId\`), INDEX \`IDX_eb3b9c7cfe7aa86bca589aee9e\` (\`pluginId\`, \`tenantId\`, \`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_billings\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`amount\` decimal(10,2) NOT NULL, \`currency\` varchar(255) NOT NULL DEFAULT 'USD', \`billingDate\` datetime NOT NULL, \`dueDate\` datetime NOT NULL, \`status\` enum ('pending', 'processed', 'paid', 'overdue', 'failed', 'cancelled', 'refunded', 'partially_paid') NOT NULL DEFAULT 'pending', \`billingPeriod\` enum ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'one-time') NOT NULL, \`billingPeriodStart\` datetime NOT NULL, \`billingPeriodEnd\` datetime NOT NULL, \`description\` text NULL, \`metadata\` json NULL, \`subscriptionId\` varchar(255) NOT NULL, INDEX \`IDX_74d0d8f22af90d92d3213d5e74\` (\`createdByUserId\`), INDEX \`IDX_2c926e12d6fba9b0d320c974f3\` (\`updatedByUserId\`), INDEX \`IDX_8fb8bf376857199096a73d90b8\` (\`deletedByUserId\`), INDEX \`IDX_e1d678ee40f241203ee5ad7d41\` (\`isActive\`), INDEX \`IDX_9e3344b0c59fcd4cd699cef727\` (\`isArchived\`), INDEX \`IDX_7b12d1d4e5d36737596155ce2d\` (\`tenantId\`), INDEX \`IDX_7d05232ee38835a76623154b7b\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_tenant_allowed_roles\` (\`pluginTenantsId\` varchar(36) NOT NULL, \`roleId\` varchar(36) NOT NULL, INDEX \`IDX_12c6c6c88720dfb785a0e066bb\` (\`pluginTenantsId\`), INDEX \`IDX_0c355caddd182f2e7099d35911\` (\`roleId\`), PRIMARY KEY (\`pluginTenantsId\`, \`roleId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_tenant_allowed_users\` (\`pluginTenantsId\` varchar(36) NOT NULL, \`userId\` varchar(36) NOT NULL, INDEX \`IDX_358b3ee7d6cac92234c829e384\` (\`pluginTenantsId\`), INDEX \`IDX_99cab633947d311b29e5e3d9f1\` (\`userId\`), PRIMARY KEY (\`pluginTenantsId\`, \`userId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_tenant_denied_users\` (\`pluginTenantsId\` varchar(36) NOT NULL, \`userId\` varchar(36) NOT NULL, INDEX \`IDX_27e45daf821a522cf6c7b794bc\` (\`pluginTenantsId\`), INDEX \`IDX_17fc7d5ec9f51d9716c79b50ae\` (\`userId\`), PRIMARY KEY (\`pluginTenantsId\`, \`userId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_categories_closure\` (\`id_ancestor\` varchar(255) NOT NULL, \`id_descendant\` varchar(255) NOT NULL, INDEX \`IDX_6eca05af711ef729dbe99f9b63\` (\`id_ancestor\`), INDEX \`IDX_ac6e3a024785d6cd7e1dc8a7d0\` (\`id_descendant\`), PRIMARY KEY (\`id_ancestor\`, \`id_descendant\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`plugin_subscriptions_closure\` (\`id_ancestor\` varchar(255) NOT NULL, \`id_descendant\` varchar(255) NOT NULL, INDEX \`IDX_31cca01b2ea11308a44475563b\` (\`id_ancestor\`), INDEX \`IDX_9c7a67d94dc7edfc580657a52d\` (\`id_descendant\`), PRIMARY KEY (\`id_ancestor\`, \`id_descendant\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project\` CHANGE \`status\` \`status\` varchar(255) NULL DEFAULT 'open'`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenants\` ADD CONSTRAINT \`FK_f209a8620f1677ed2c82c4cd2e4\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenants\` ADD CONSTRAINT \`FK_0b5cc71673410a449491fb3db93\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenants\` ADD CONSTRAINT \`FK_06f10073cd6e84a19b6f604ddd1\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenants\` ADD CONSTRAINT \`FK_5df2b63d82f2168e43c2d7e64c1\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenants\` ADD CONSTRAINT \`FK_545faee53386f4e9d7b43111047\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenants\` ADD CONSTRAINT \`FK_c47db2e2072ba3b570608192467\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugins\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenants\` ADD CONSTRAINT \`FK_52ca2ab9f943fe3f47df36aef76\` FOREIGN KEY (\`approvedById\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_5534e36ff3a1416c17f507d5469\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_6b8deef29d0fb5eee571c39b39b\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_a97ab238dc6aff5f305d37dbc72\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_bbced9536ca0a8ee967b531c325\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_d4504369b0f19d2360a464408ad\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_737e0935140d7b17632fc7815ad\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugins\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_8e11188fb92db2ee126b53e866e\` FOREIGN KEY (\`pluginTenantId\`) REFERENCES \`plugin_tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_a8471a91f63494a0d3ec5cf248c\` FOREIGN KEY (\`categoryId\`) REFERENCES \`plugin_categories\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_settings\` ADD CONSTRAINT \`FK_734649a34ee071f44de4a14490d\` FOREIGN KEY (\`updatedById\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` ADD CONSTRAINT \`FK_60543808734ff13850d7843f7b8\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` ADD CONSTRAINT \`FK_c7c4b6b97be418be173859d10da\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` ADD CONSTRAINT \`FK_1fa4520b20a0bf4fdfe3ca1ec7b\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` ADD CONSTRAINT \`FK_7c239f665e5caedd708c62b1f7a\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` ADD CONSTRAINT \`FK_ca31918911db08a4008be72c8e5\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` ADD CONSTRAINT \`FK_70bfaf5965c91621dedb183bc81\` FOREIGN KEY (\`parentId\`) REFERENCES \`plugin_categories\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tags\` ADD CONSTRAINT \`FK_9b013a85a6ae26db17101ffb894\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tags\` ADD CONSTRAINT \`FK_ee480ffb800fb2c9f6d91f66aa7\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tags\` ADD CONSTRAINT \`FK_09654ebaec00e0c0c4dfae4c427\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tags\` ADD CONSTRAINT \`FK_da359f059e06030ec33adba1335\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tags\` ADD CONSTRAINT \`FK_8bcd0243b780191a391b348f582\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tags\` ADD CONSTRAINT \`FK_05292c8750270ff028ab2fec140\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugins\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tags\` ADD CONSTRAINT \`FK_df3d0fc648c9e0544ca11df9d2e\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_842e5e5f94c4008a42d4b5f44a6\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_7e9b8b3eebb881753e07b73f6c6\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_a45f5c2aba22d4fa4eb8fa85af8\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_dff9e6c763c8c33b07f330e6a19\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_8aafffefdce2eb11079ec2aa755\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_547e4b71ae81ee772fa4ab79e60\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugins\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_acac58b213936ea488d0a8d1a30\` FOREIGN KEY (\`versionId\`) REFERENCES \`plugin_versions\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` ADD CONSTRAINT \`FK_32c3f7a738ec8b40d6375b2933c\` FOREIGN KEY (\`installedById\`) REFERENCES \`employee\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_sources\` ADD CONSTRAINT \`FK_09a383d6f2858d49c064ca4cda9\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_sources\` ADD CONSTRAINT \`FK_0404416b5c1cd48ae87fe81834a\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_sources\` ADD CONSTRAINT \`FK_c90b796bd033e54e3719213a0ce\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_sources\` ADD CONSTRAINT \`FK_19d9135639e3b40ec0dca1c9261\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_sources\` ADD CONSTRAINT \`FK_7c6dc1cdd58690b7179d76184be\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_sources\` ADD CONSTRAINT \`FK_55bee446d2c470e5d6b066a27a2\` FOREIGN KEY (\`versionId\`) REFERENCES \`plugin_versions\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_versions\` ADD CONSTRAINT \`FK_485db4d1cc977cc3d499824d958\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_versions\` ADD CONSTRAINT \`FK_0b36b5701e9890a395ded76cb57\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_versions\` ADD CONSTRAINT \`FK_e06094816e67e584dea754cc81c\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_versions\` ADD CONSTRAINT \`FK_650ccf2e7394509f7ad8448e323\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_versions\` ADD CONSTRAINT \`FK_f806bae81cd490404a1888ad5b9\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_versions\` ADD CONSTRAINT \`FK_8adf7a9181e968bcafc71236c80\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugins\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugins\` ADD CONSTRAINT \`FK_cc5b64091fbfdcdbd23d6da80ee\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugins\` ADD CONSTRAINT \`FK_61357761fc6b140180b104dc8d5\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugins\` ADD CONSTRAINT \`FK_3210c015451d02d015a23eedad4\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugins\` ADD CONSTRAINT \`FK_16d0aed6fcc311379f5c75bbd2d\` FOREIGN KEY (\`categoryId\`) REFERENCES \`plugin_categories\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugins\` ADD CONSTRAINT \`FK_4bf89f98c41969e23e3f9974d56\` FOREIGN KEY (\`uploadedById\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` ADD CONSTRAINT \`FK_646aa1161ac9861061842e05c2f\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` ADD CONSTRAINT \`FK_b874f9ee9c04061b4892926388f\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` ADD CONSTRAINT \`FK_6f401b811d14d8b06db0fbea308\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` ADD CONSTRAINT \`FK_a06a8b0e7f54e73cfc92c96511b\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugins\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` ADD CONSTRAINT \`FK_d3afff45d3c259d2d484387a248\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_449b2294593f5787f40a60c8f23\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_ddf7be116060ee20bc16128632d\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_0be98c36cdbaa56f3880bc6baa5\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_7f792e3c1891f728f9e52561428\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_9bbac226cce476576134c5726e2\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_052c95e24f8ac2afdea389d31e0\` FOREIGN KEY (\`pluginId\`) REFERENCES \`plugins\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_6163fac447615c15bdd3cc4b108\` FOREIGN KEY (\`pluginTenantId\`) REFERENCES \`plugin_tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_4e8a9f4ee7df8c39d0314063e73\` FOREIGN KEY (\`planId\`) REFERENCES \`plugin_subscription_plans\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_b76c1241cbcbe8a92cba6d7fbcd\` FOREIGN KEY (\`subscriberId\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` ADD CONSTRAINT \`FK_39a16aca760fc7a3cef39d55638\` FOREIGN KEY (\`parentId\`) REFERENCES \`plugin_subscriptions\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_billings\` ADD CONSTRAINT \`FK_74d0d8f22af90d92d3213d5e74e\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_billings\` ADD CONSTRAINT \`FK_2c926e12d6fba9b0d320c974f32\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_billings\` ADD CONSTRAINT \`FK_8fb8bf376857199096a73d90b86\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_billings\` ADD CONSTRAINT \`FK_7b12d1d4e5d36737596155ce2d5\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_billings\` ADD CONSTRAINT \`FK_7d05232ee38835a76623154b7b2\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_billings\` ADD CONSTRAINT \`FK_3c3212b2cf3a4e6cc6896657bb1\` FOREIGN KEY (\`subscriptionId\`) REFERENCES \`plugin_subscriptions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_roles\` ADD CONSTRAINT \`FK_12c6c6c88720dfb785a0e066bb6\` FOREIGN KEY (\`pluginTenantsId\`) REFERENCES \`plugin_tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_roles\` ADD CONSTRAINT \`FK_0c355caddd182f2e7099d359119\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_users\` ADD CONSTRAINT \`FK_358b3ee7d6cac92234c829e3844\` FOREIGN KEY (\`pluginTenantsId\`) REFERENCES \`plugin_tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_users\` ADD CONSTRAINT \`FK_99cab633947d311b29e5e3d9f16\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_denied_users\` ADD CONSTRAINT \`FK_27e45daf821a522cf6c7b794bce\` FOREIGN KEY (\`pluginTenantsId\`) REFERENCES \`plugin_tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_denied_users\` ADD CONSTRAINT \`FK_17fc7d5ec9f51d9716c79b50ae8\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories_closure\` ADD CONSTRAINT \`FK_6eca05af711ef729dbe99f9b634\` FOREIGN KEY (\`id_ancestor\`) REFERENCES \`plugin_categories\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories_closure\` ADD CONSTRAINT \`FK_ac6e3a024785d6cd7e1dc8a7d08\` FOREIGN KEY (\`id_descendant\`) REFERENCES \`plugin_categories\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions_closure\` ADD CONSTRAINT \`FK_31cca01b2ea11308a44475563b3\` FOREIGN KEY (\`id_ancestor\`) REFERENCES \`plugin_subscriptions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions_closure\` ADD CONSTRAINT \`FK_9c7a67d94dc7edfc580657a52df\` FOREIGN KEY (\`id_descendant\`) REFERENCES \`plugin_subscriptions\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions_closure\` DROP FOREIGN KEY \`FK_9c7a67d94dc7edfc580657a52df\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions_closure\` DROP FOREIGN KEY \`FK_31cca01b2ea11308a44475563b3\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories_closure\` DROP FOREIGN KEY \`FK_ac6e3a024785d6cd7e1dc8a7d08\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories_closure\` DROP FOREIGN KEY \`FK_6eca05af711ef729dbe99f9b634\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_denied_users\` DROP FOREIGN KEY \`FK_17fc7d5ec9f51d9716c79b50ae8\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_denied_users\` DROP FOREIGN KEY \`FK_27e45daf821a522cf6c7b794bce\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_users\` DROP FOREIGN KEY \`FK_99cab633947d311b29e5e3d9f16\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_users\` DROP FOREIGN KEY \`FK_358b3ee7d6cac92234c829e3844\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_roles\` DROP FOREIGN KEY \`FK_0c355caddd182f2e7099d359119\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_tenant_allowed_roles\` DROP FOREIGN KEY \`FK_12c6c6c88720dfb785a0e066bb6\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`plugin_billings\` DROP FOREIGN KEY \`FK_3c3212b2cf3a4e6cc6896657bb1\``);
		await queryRunner.query(`ALTER TABLE \`plugin_billings\` DROP FOREIGN KEY \`FK_7d05232ee38835a76623154b7b2\``);
		await queryRunner.query(`ALTER TABLE \`plugin_billings\` DROP FOREIGN KEY \`FK_7b12d1d4e5d36737596155ce2d5\``);
		await queryRunner.query(`ALTER TABLE \`plugin_billings\` DROP FOREIGN KEY \`FK_8fb8bf376857199096a73d90b86\``);
		await queryRunner.query(`ALTER TABLE \`plugin_billings\` DROP FOREIGN KEY \`FK_2c926e12d6fba9b0d320c974f32\``);
		await queryRunner.query(`ALTER TABLE \`plugin_billings\` DROP FOREIGN KEY \`FK_74d0d8f22af90d92d3213d5e74e\``);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_39a16aca760fc7a3cef39d55638\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_b76c1241cbcbe8a92cba6d7fbcd\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_4e8a9f4ee7df8c39d0314063e73\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_6163fac447615c15bdd3cc4b108\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_052c95e24f8ac2afdea389d31e0\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_9bbac226cce476576134c5726e2\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_7f792e3c1891f728f9e52561428\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_0be98c36cdbaa56f3880bc6baa5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_ddf7be116060ee20bc16128632d\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscriptions\` DROP FOREIGN KEY \`FK_449b2294593f5787f40a60c8f23\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` DROP FOREIGN KEY \`FK_d3afff45d3c259d2d484387a248\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` DROP FOREIGN KEY \`FK_a06a8b0e7f54e73cfc92c96511b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` DROP FOREIGN KEY \`FK_6f401b811d14d8b06db0fbea308\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` DROP FOREIGN KEY \`FK_b874f9ee9c04061b4892926388f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_subscription_plans\` DROP FOREIGN KEY \`FK_646aa1161ac9861061842e05c2f\``
		);
		await queryRunner.query(`ALTER TABLE \`plugins\` DROP FOREIGN KEY \`FK_4bf89f98c41969e23e3f9974d56\``);
		await queryRunner.query(`ALTER TABLE \`plugins\` DROP FOREIGN KEY \`FK_16d0aed6fcc311379f5c75bbd2d\``);
		await queryRunner.query(`ALTER TABLE \`plugins\` DROP FOREIGN KEY \`FK_3210c015451d02d015a23eedad4\``);
		await queryRunner.query(`ALTER TABLE \`plugins\` DROP FOREIGN KEY \`FK_61357761fc6b140180b104dc8d5\``);
		await queryRunner.query(`ALTER TABLE \`plugins\` DROP FOREIGN KEY \`FK_cc5b64091fbfdcdbd23d6da80ee\``);
		await queryRunner.query(`ALTER TABLE \`plugin_versions\` DROP FOREIGN KEY \`FK_8adf7a9181e968bcafc71236c80\``);
		await queryRunner.query(`ALTER TABLE \`plugin_versions\` DROP FOREIGN KEY \`FK_f806bae81cd490404a1888ad5b9\``);
		await queryRunner.query(`ALTER TABLE \`plugin_versions\` DROP FOREIGN KEY \`FK_650ccf2e7394509f7ad8448e323\``);
		await queryRunner.query(`ALTER TABLE \`plugin_versions\` DROP FOREIGN KEY \`FK_e06094816e67e584dea754cc81c\``);
		await queryRunner.query(`ALTER TABLE \`plugin_versions\` DROP FOREIGN KEY \`FK_0b36b5701e9890a395ded76cb57\``);
		await queryRunner.query(`ALTER TABLE \`plugin_versions\` DROP FOREIGN KEY \`FK_485db4d1cc977cc3d499824d958\``);
		await queryRunner.query(`ALTER TABLE \`plugin_sources\` DROP FOREIGN KEY \`FK_55bee446d2c470e5d6b066a27a2\``);
		await queryRunner.query(`ALTER TABLE \`plugin_sources\` DROP FOREIGN KEY \`FK_7c6dc1cdd58690b7179d76184be\``);
		await queryRunner.query(`ALTER TABLE \`plugin_sources\` DROP FOREIGN KEY \`FK_19d9135639e3b40ec0dca1c9261\``);
		await queryRunner.query(`ALTER TABLE \`plugin_sources\` DROP FOREIGN KEY \`FK_c90b796bd033e54e3719213a0ce\``);
		await queryRunner.query(`ALTER TABLE \`plugin_sources\` DROP FOREIGN KEY \`FK_0404416b5c1cd48ae87fe81834a\``);
		await queryRunner.query(`ALTER TABLE \`plugin_sources\` DROP FOREIGN KEY \`FK_09a383d6f2858d49c064ca4cda9\``);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_32c3f7a738ec8b40d6375b2933c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_acac58b213936ea488d0a8d1a30\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_547e4b71ae81ee772fa4ab79e60\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_8aafffefdce2eb11079ec2aa755\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_dff9e6c763c8c33b07f330e6a19\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_a45f5c2aba22d4fa4eb8fa85af8\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_7e9b8b3eebb881753e07b73f6c6\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_installations\` DROP FOREIGN KEY \`FK_842e5e5f94c4008a42d4b5f44a6\``
		);
		await queryRunner.query(`ALTER TABLE \`plugin_tags\` DROP FOREIGN KEY \`FK_df3d0fc648c9e0544ca11df9d2e\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tags\` DROP FOREIGN KEY \`FK_05292c8750270ff028ab2fec140\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tags\` DROP FOREIGN KEY \`FK_8bcd0243b780191a391b348f582\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tags\` DROP FOREIGN KEY \`FK_da359f059e06030ec33adba1335\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tags\` DROP FOREIGN KEY \`FK_09654ebaec00e0c0c4dfae4c427\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tags\` DROP FOREIGN KEY \`FK_ee480ffb800fb2c9f6d91f66aa7\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tags\` DROP FOREIGN KEY \`FK_9b013a85a6ae26db17101ffb894\``);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` DROP FOREIGN KEY \`FK_70bfaf5965c91621dedb183bc81\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` DROP FOREIGN KEY \`FK_ca31918911db08a4008be72c8e5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` DROP FOREIGN KEY \`FK_7c239f665e5caedd708c62b1f7a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` DROP FOREIGN KEY \`FK_1fa4520b20a0bf4fdfe3ca1ec7b\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` DROP FOREIGN KEY \`FK_c7c4b6b97be418be173859d10da\``
		);
		await queryRunner.query(
			`ALTER TABLE \`plugin_categories\` DROP FOREIGN KEY \`FK_60543808734ff13850d7843f7b8\``
		);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_734649a34ee071f44de4a14490d\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_a8471a91f63494a0d3ec5cf248c\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_8e11188fb92db2ee126b53e866e\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_737e0935140d7b17632fc7815ad\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_d4504369b0f19d2360a464408ad\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_bbced9536ca0a8ee967b531c325\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_a97ab238dc6aff5f305d37dbc72\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_6b8deef29d0fb5eee571c39b39b\``);
		await queryRunner.query(`ALTER TABLE \`plugin_settings\` DROP FOREIGN KEY \`FK_5534e36ff3a1416c17f507d5469\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tenants\` DROP FOREIGN KEY \`FK_52ca2ab9f943fe3f47df36aef76\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tenants\` DROP FOREIGN KEY \`FK_c47db2e2072ba3b570608192467\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tenants\` DROP FOREIGN KEY \`FK_545faee53386f4e9d7b43111047\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tenants\` DROP FOREIGN KEY \`FK_5df2b63d82f2168e43c2d7e64c1\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tenants\` DROP FOREIGN KEY \`FK_06f10073cd6e84a19b6f604ddd1\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tenants\` DROP FOREIGN KEY \`FK_0b5cc71673410a449491fb3db93\``);
		await queryRunner.query(`ALTER TABLE \`plugin_tenants\` DROP FOREIGN KEY \`FK_f209a8620f1677ed2c82c4cd2e4\``);
		await queryRunner.query(`ALTER TABLE \`organization_project\` CHANGE \`status\` \`status\` varchar(255) NULL`);
		await queryRunner.query(`DROP INDEX \`IDX_9c7a67d94dc7edfc580657a52d\` ON \`plugin_subscriptions_closure\``);
		await queryRunner.query(`DROP INDEX \`IDX_31cca01b2ea11308a44475563b\` ON \`plugin_subscriptions_closure\``);
		await queryRunner.query(`DROP TABLE \`plugin_subscriptions_closure\``);
		await queryRunner.query(`DROP INDEX \`IDX_ac6e3a024785d6cd7e1dc8a7d0\` ON \`plugin_categories_closure\``);
		await queryRunner.query(`DROP INDEX \`IDX_6eca05af711ef729dbe99f9b63\` ON \`plugin_categories_closure\``);
		await queryRunner.query(`DROP TABLE \`plugin_categories_closure\``);
		await queryRunner.query(`DROP INDEX \`IDX_17fc7d5ec9f51d9716c79b50ae\` ON \`plugin_tenant_denied_users\``);
		await queryRunner.query(`DROP INDEX \`IDX_27e45daf821a522cf6c7b794bc\` ON \`plugin_tenant_denied_users\``);
		await queryRunner.query(`DROP TABLE \`plugin_tenant_denied_users\``);
		await queryRunner.query(`DROP INDEX \`IDX_99cab633947d311b29e5e3d9f1\` ON \`plugin_tenant_allowed_users\``);
		await queryRunner.query(`DROP INDEX \`IDX_358b3ee7d6cac92234c829e384\` ON \`plugin_tenant_allowed_users\``);
		await queryRunner.query(`DROP TABLE \`plugin_tenant_allowed_users\``);
		await queryRunner.query(`DROP INDEX \`IDX_0c355caddd182f2e7099d35911\` ON \`plugin_tenant_allowed_roles\``);
		await queryRunner.query(`DROP INDEX \`IDX_12c6c6c88720dfb785a0e066bb\` ON \`plugin_tenant_allowed_roles\``);
		await queryRunner.query(`DROP TABLE \`plugin_tenant_allowed_roles\``);
		await queryRunner.query(`DROP INDEX \`IDX_7d05232ee38835a76623154b7b\` ON \`plugin_billings\``);
		await queryRunner.query(`DROP INDEX \`IDX_7b12d1d4e5d36737596155ce2d\` ON \`plugin_billings\``);
		await queryRunner.query(`DROP INDEX \`IDX_9e3344b0c59fcd4cd699cef727\` ON \`plugin_billings\``);
		await queryRunner.query(`DROP INDEX \`IDX_e1d678ee40f241203ee5ad7d41\` ON \`plugin_billings\``);
		await queryRunner.query(`DROP INDEX \`IDX_8fb8bf376857199096a73d90b8\` ON \`plugin_billings\``);
		await queryRunner.query(`DROP INDEX \`IDX_2c926e12d6fba9b0d320c974f3\` ON \`plugin_billings\``);
		await queryRunner.query(`DROP INDEX \`IDX_74d0d8f22af90d92d3213d5e74\` ON \`plugin_billings\``);
		await queryRunner.query(`DROP TABLE \`plugin_billings\``);
		await queryRunner.query(`DROP INDEX \`IDX_eb3b9c7cfe7aa86bca589aee9e\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_af82eaa17a59e0cf0fac16d7fe\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_fed0c61e1d142e1c448a45e5a0\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_448990d16086477ee1c5f08968\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_18db53b62833e1bdb9949b5827\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_4e8a9f4ee7df8c39d0314063e7\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_bbd6dc08c0c91724e5d26202fa\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_39a16aca760fc7a3cef39d5563\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_7afeffe18364cae48efd454e4d\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_9bbac226cce476576134c5726e\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_7f792e3c1891f728f9e5256142\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_b5163f874ce5bc6b63c8e8631a\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_18743cb5933b78e2b8081589e4\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_0be98c36cdbaa56f3880bc6baa\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_ddf7be116060ee20bc16128632\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_449b2294593f5787f40a60c8f2\` ON \`plugin_subscriptions\``);
		await queryRunner.query(`DROP TABLE \`plugin_subscriptions\``);
		await queryRunner.query(`DROP INDEX \`IDX_082f6cba880ecd144b28284376\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_37c9e1c698331b9345280374fd\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_234c8f3d694ae31b095bdf5a8a\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_dec9037a57726ae5f54bc3c4a8\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_a7bf8b446ca66e5824fb6ff91a\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_6f401b811d14d8b06db0fbea30\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_b874f9ee9c04061b4892926388\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_646aa1161ac9861061842e05c2\` ON \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP TABLE \`plugin_subscription_plans\``);
		await queryRunner.query(`DROP INDEX \`IDX_0479844f05c1132f8929cab1c8\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_6c8d4a0f437cfae296ef43ce13\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_c0fab3c6709a93bca88eb100a9\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_123f1b37f4826f6241446a8416\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_15ca158f27ab3296915b7d1b38\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_4bf89f98c41969e23e3f9974d5\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_16d0aed6fcc311379f5c75bbd2\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_100eef6409ee96d0673ee510e6\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_35ee1cb5098e17e30ee5cbc705\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_c61c7032e7b3afd352d82bc4b4\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_d0a1444aa92229d7f1af237184\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_3210c015451d02d015a23eedad\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_61357761fc6b140180b104dc8d\` ON \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_cc5b64091fbfdcdbd23d6da80e\` ON \`plugins\``);
		await queryRunner.query(`DROP TABLE \`plugins\``);
		await queryRunner.query(`DROP INDEX \`IDX_39d060301c8a36b51da6e4aec3\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_f5c8259c0d815486f31878864d\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_e1e7cf1589d06ac02a12e41db0\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_e632aa70ea7b7e5c5fdbfba41b\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_6fa0eda3add1fb070ba172a44e\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_8adf7a9181e968bcafc71236c8\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_ab6e29cd444226f80bf0c0c1db\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_f806bae81cd490404a1888ad5b\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_650ccf2e7394509f7ad8448e32\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_a16869769b9a219acb157bb2b3\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_e6d49799b916946e5cd5399385\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_e06094816e67e584dea754cc81\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_0b36b5701e9890a395ded76cb5\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_485db4d1cc977cc3d499824d95\` ON \`plugin_versions\``);
		await queryRunner.query(`DROP TABLE \`plugin_versions\``);
		await queryRunner.query(`DROP INDEX \`IDX_6fae6d0ddfd7177abcb4befd72\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_af8978fbf37560525c19ec7048\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_d658bc853b354445cf2a0d6fb7\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_55bee446d2c470e5d6b066a27a\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_7c6dc1cdd58690b7179d76184b\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_19d9135639e3b40ec0dca1c926\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_0ab83b39cc676ee2097714fb3b\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_cb9a1e5640b8e07a9a63b51245\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_c90b796bd033e54e3719213a0c\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_0404416b5c1cd48ae87fe81834\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_09a383d6f2858d49c064ca4cda\` ON \`plugin_sources\``);
		await queryRunner.query(`DROP TABLE \`plugin_sources\``);
		await queryRunner.query(`DROP INDEX \`IDX_1569d8ca526d958d82483e15c7\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_173e0668b17afd3696abf3c518\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_3c3ce338e7716d853220d8b176\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_5e6b80341a4ed75ae7c4af6897\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_c92ea21dfcfd889730e2214c8f\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_28624735b4e3ace75883521a57\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_32c3f7a738ec8b40d6375b2933\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_acac58b213936ea488d0a8d1a3\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_547e4b71ae81ee772fa4ab79e6\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_8aafffefdce2eb11079ec2aa75\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_dff9e6c763c8c33b07f330e6a1\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_3e63eed07bcc0e3e36d9183cca\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_d742ed346264f4c9d9225265d7\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_a45f5c2aba22d4fa4eb8fa85af\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_7e9b8b3eebb881753e07b73f6c\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_842e5e5f94c4008a42d4b5f44a\` ON \`plugin_installations\``);
		await queryRunner.query(`DROP TABLE \`plugin_installations\``);
		await queryRunner.query(`DROP INDEX \`IDX_676e7c749905331c36b1707ba8\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_cddb5e04a93a957dc4d56522b7\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_17c923b300710a13f6dfade59b\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_df3d0fc648c9e0544ca11df9d2\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_05292c8750270ff028ab2fec14\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_8bcd0243b780191a391b348f58\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_da359f059e06030ec33adba133\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_cacbb5fd767b06985be6049858\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_fe4db46e2c3d32f64b4a4728e3\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_09654ebaec00e0c0c4dfae4c42\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_ee480ffb800fb2c9f6d91f66aa\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_9b013a85a6ae26db17101ffb89\` ON \`plugin_tags\``);
		await queryRunner.query(`DROP TABLE \`plugin_tags\``);
		await queryRunner.query(`DROP INDEX \`IDX_d427c34c4dd721c72d5d56187f\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_ca31918911db08a4008be72c8e\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_7c239f665e5caedd708c62b1f7\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_b23665ef0d73dbe47d4d26f3d5\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_99ab190a6b7ae5ffc61b4dfaf4\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_1fa4520b20a0bf4fdfe3ca1ec7\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_c7c4b6b97be418be173859d10d\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_60543808734ff13850d7843f7b\` ON \`plugin_categories\``);
		await queryRunner.query(`DROP TABLE \`plugin_categories\``);
		await queryRunner.query(`DROP INDEX \`IDX_48aa394150a960cf3e7b285cf4\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_734649a34ee071f44de4a14490\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_a8471a91f63494a0d3ec5cf248\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_8e11188fb92db2ee126b53e866\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_737e0935140d7b17632fc7815a\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_d4504369b0f19d2360a464408a\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_bbced9536ca0a8ee967b531c32\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_199b3708ea7962d21fc55de243\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_cf20745f234b0b3512c03d74be\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_a97ab238dc6aff5f305d37dbc7\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_6b8deef29d0fb5eee571c39b39\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_5534e36ff3a1416c17f507d546\` ON \`plugin_settings\``);
		await queryRunner.query(`DROP TABLE \`plugin_settings\``);
		await queryRunner.query(`DROP INDEX \`IDX_1394aebfcfe6782051e76f46a5\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_a3a616a07b21a4212736493f5e\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_69f72957e1c98832cdab0c486e\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_4f1dada611375594ce22411cbe\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_52ca2ab9f943fe3f47df36aef7\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_a32259b1b9cdeea1c6d94bf94c\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_1aca41d7ee08b3b140eae4ee88\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_c4accce384c6007c92b9afdc2d\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_e723cb5fdc4092538fe0384853\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_6d6a338f4eb5b467c2ff5eaa4b\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_c47db2e2072ba3b57060819246\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_545faee53386f4e9d7b4311104\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_5df2b63d82f2168e43c2d7e64c\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_0ed7c977facb534e572d33b485\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_cf185e176c869e2be48d00d648\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_06f10073cd6e84a19b6f604ddd\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_0b5cc71673410a449491fb3db9\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP INDEX \`IDX_f209a8620f1677ed2c82c4cd2e\` ON \`plugin_tenants\``);
		await queryRunner.query(`DROP TABLE \`plugin_tenants\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
