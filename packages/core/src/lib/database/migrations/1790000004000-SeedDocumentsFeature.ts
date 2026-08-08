import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { FeatureEnum } from '@gauzy/contracts';
import { DatabaseTypeEnum } from '@gauzy/config';

export class SeedDocumentsFeature1790000004000 implements MigrationInterface {
	name = 'SeedDocumentsFeature1790000004000';

	/**
	 * The `FEATURE_DOCUMENTS` catalog row, mirroring its `DEFAULT_FEATURES` entry
	 * (packages/core/src/lib/feature/default-features.ts). Fresh installs get the row
	 * from the normal `feature.seed.ts` path; this migration inserts it (guarded, so it
	 * is idempotent) for already-seeded deployments.
	 */
	private readonly feature = {
		name: 'Documents',
		code: FeatureEnum.FEATURE_DOCUMENTS,
		description: 'Central hub for company documents: uploads, wiki pages, review, and AI knowledge',
		image: 'documents.png',
		link: 'pages/documents',
		status: 'info',
		icon: 'fas fa-book'
	};

	/**
	 * Up Migration
	 *
	 * Seeds the `FEATURE_DOCUMENTS` catalog row AND the per-tenant `feature_organization`
	 * toggle rows that actually switch the feature on. There is no lazy-creation path for
	 * those toggle rows: `Store.hasFeatureEnabled()` resolves a feature from the rows the
	 * API returns (`tenant.featureOrganizations` / `organization.featureOrganizations`), so
	 * a missing row reads as "disabled" and both the Documents nav item and its route stay
	 * hidden on every already-seeded deployment.
	 *
	 * Rows are created tenant-scoped (`organizationId` NULL), exactly like `feature.seed.ts`
	 * does for a fresh install — organization-scoped rows only ever exist once someone
	 * toggles the feature for a specific organization.
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
	 * Removes the seeded `FEATURE_DOCUMENTS` row (and its per-org toggle rows).
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await queryRunner.query(
					`DELETE FROM "feature_organization" WHERE "featureId" IN (SELECT "id" FROM "feature" WHERE "code" = ?)`,
					[this.feature.code]
				);
				await queryRunner.query(`DELETE FROM "feature" WHERE "code" = ?`, [this.feature.code]);
				break;
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(
					`DELETE FROM "feature_organization" WHERE "featureId" IN (SELECT "id" FROM "feature" WHERE "code" = $1)`,
					[this.feature.code]
				);
				await queryRunner.query(`DELETE FROM "feature" WHERE "code" = $1`, [this.feature.code]);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(
					`DELETE FROM \`feature_organization\` WHERE \`featureId\` IN (SELECT \`id\` FROM \`feature\` WHERE \`code\` = ?)`,
					[this.feature.code]
				);
				await queryRunner.query(`DELETE FROM \`feature\` WHERE \`code\` = ?`, [this.feature.code]);
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
		const { name, code, description, image, link, status, icon } = this.feature;
		await queryRunner.query(
			`INSERT INTO "feature" ("id", "name", "code", "description", "image", "link", "status", "icon")
			 SELECT gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7
			 WHERE NOT EXISTS (SELECT 1 FROM "feature" WHERE "code" = $2)`,
			[name, code, description, image, link, status, icon]
		);

		/**
		 * One enabled, tenant-scoped toggle row per live tenant that does not have one yet.
		 * `NOT EXISTS` makes it re-runnable and keeps any tenant that already opted out untouched.
		 */
		await queryRunner.query(
			`INSERT INTO "feature_organization" ("id", "tenantId", "featureId", "isEnabled")
			 SELECT gen_random_uuid(), "tenant"."id", "feature"."id", true
			 FROM "tenant", "feature"
			 WHERE "feature"."code" = $1
			   AND "tenant"."deletedAt" IS NULL
			   AND NOT EXISTS (
				SELECT 1 FROM "feature_organization" "fo"
				WHERE "fo"."featureId" = "feature"."id"
				  AND "fo"."tenantId" = "tenant"."id"
				  AND "fo"."organizationId" IS NULL
			   )`,
			[code]
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const { name, code, description, image, link, status, icon } = this.feature;
		await queryRunner.query(
			`INSERT INTO "feature" ("id", "name", "code", "description", "image", "link", "status", "icon")
			 SELECT ?, ?, ?, ?, ?, ?, ?, ?
			 WHERE NOT EXISTS (SELECT 1 FROM "feature" WHERE "code" = ?)`,
			[uuidv4(), name, code, description, image, link, status, icon, code]
		);

		/**
		 * SQLite has no server side UUID generator, so the ids are generated here and the
		 * missing (tenant, feature) pairs are resolved first. Same `NOT EXISTS` guard as the
		 * other dialects, so the migration stays re-runnable.
		 */
		const rows: { tenantId: string; featureId: string }[] = await queryRunner.query(
			`SELECT "tenant"."id" AS "tenantId", "feature"."id" AS "featureId"
			 FROM "tenant", "feature"
			 WHERE "feature"."code" = ?
			   AND "tenant"."deletedAt" IS NULL
			   AND NOT EXISTS (
				SELECT 1 FROM "feature_organization" "fo"
				WHERE "fo"."featureId" = "feature"."id"
				  AND "fo"."tenantId" = "tenant"."id"
				  AND "fo"."organizationId" IS NULL
			   )`,
			[code]
		);

		for (const row of rows ?? []) {
			await queryRunner.query(
				`INSERT INTO "feature_organization" ("id", "tenantId", "featureId", "isEnabled") VALUES (?, ?, ?, ?)`,
				[uuidv4(), row.tenantId, row.featureId, 1]
			);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		const { name, code, description, image, link, status, icon } = this.feature;
		await queryRunner.query(
			`INSERT INTO \`feature\` (\`id\`, \`name\`, \`code\`, \`description\`, \`image\`, \`link\`, \`status\`, \`icon\`)
			 SELECT ?, ?, ?, ?, ?, ?, ?, ?
			 FROM DUAL
			 WHERE NOT EXISTS (SELECT 1 FROM \`feature\` WHERE \`code\` = ?)`,
			[uuidv4(), name, code, description, image, link, status, icon, code]
		);

		/**
		 * One enabled, tenant-scoped toggle row per live tenant that does not have one yet.
		 * `NOT EXISTS` makes it re-runnable and keeps any tenant that already opted out untouched.
		 */
		await queryRunner.query(
			`INSERT INTO \`feature_organization\` (\`id\`, \`tenantId\`, \`featureId\`, \`isEnabled\`)
			 SELECT UUID(), \`tenant\`.\`id\`, \`feature\`.\`id\`, 1
			 FROM \`tenant\`, \`feature\`
			 WHERE \`feature\`.\`code\` = ?
			   AND \`tenant\`.\`deletedAt\` IS NULL
			   AND NOT EXISTS (
				SELECT 1 FROM \`feature_organization\` \`fo\`
				WHERE \`fo\`.\`featureId\` = \`feature\`.\`id\`
				  AND \`fo\`.\`tenantId\` = \`tenant\`.\`id\`
				  AND \`fo\`.\`organizationId\` IS NULL
			   )`,
			[code]
		);
	}
}
