import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the catalog tables.
 *
 * The catalogue does not own a product, a variant, a category, a tag or an image: those rows already
 * exist on the platform, and this set adds only what was missing to *present* them — publication per
 * channel, curated collections with a tree, variant-level facets and galleries, and directed
 * product-to-product links.
 *
 * `collection_closure` is created here and is deliberately **not** an entity: it is the closure table
 * the ORM's tree strategy maintains for the self-referencing `collection.parentId`, and declaring a
 * class for it would let two writers disagree about its contents.
 *
 * The channel is a platform concept delivered by the kernel scoping set, so `channelId` columns carry
 * their referential constraint here while the row they point at belongs to core.
 */
export class CreateCatalogTables1791000000100 implements MigrationInterface {
	name = 'CreateCatalogTables1791000000100';

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
			`CREATE TABLE "collection" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "name" character varying(255) NOT NULL, "slug" character varying(255) NOT NULL, "description" text, "type" character varying(16) NOT NULL DEFAULT 'MANUAL', "imageId" uuid, "parentId" uuid, "sortOrder" integer NOT NULL DEFAULT 0, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "startsAt" TIMESTAMP, "endsAt" TIMESTAMP, "isFeatured" boolean NOT NULL DEFAULT false, "customerId" uuid, "metadata" jsonb, CONSTRAINT "PK_collection_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_created_by_user" ON "collection" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_updated_by_user" ON "collection" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_deleted_by_user" ON "collection" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_is_active" ON "collection" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_is_archived" ON "collection" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_tenant" ON "collection" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_organization" ON "collection" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_slug" ON "collection" ("slug")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_type" ON "collection" ("type")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_status" ON "collection" ("status")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_image" ON "collection" ("imageId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_parent" ON "collection" ("parentId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_customer" ON "collection" ("customerId")`);
		// One slug per organization for a merchandising collection, and one per buyer for a saved list.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_org_slug" ON "collection" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "slug") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_customer_slug" ON "collection" ("customerId", "slug") WHERE "customerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_org_status" ON "collection" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_parent_sort" ON "collection" ("parentId", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_window" ON "collection" ("status", "startsAt", "endsAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`ALTER TABLE "collection" ADD CONSTRAINT "FK_collection_image" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "collection" ADD CONSTRAINT "FK_collection_parent" FOREIGN KEY ("parentId") REFERENCES "collection"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "collection" ADD CONSTRAINT "FK_collection_customer" FOREIGN KEY ("customerId") REFERENCES "organization_contact"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		// The closure table the tree strategy maintains. One row per (ancestor, descendant) pair,
		// including the self-referencing row that makes "descendants of a collection" return it too.
		await queryRunner.query(
			`CREATE TABLE "collection_closure" ("id_ancestor" uuid NOT NULL, "id_descendant" uuid NOT NULL, CONSTRAINT "PK_collection_closure" PRIMARY KEY ("id_ancestor", "id_descendant"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_closure_ancestor" ON "collection_closure" ("id_ancestor")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_closure_descendant" ON "collection_closure" ("id_descendant")`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_closure" ADD CONSTRAINT "FK_collection_closure_ancestor" FOREIGN KEY ("id_ancestor") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_closure" ADD CONSTRAINT "FK_collection_closure_descendant" FOREIGN KEY ("id_descendant") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "collection_product" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "collectionId" uuid NOT NULL, "productId" uuid NOT NULL, "position" integer NOT NULL DEFAULT 0, "addedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_collection_product_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_created_by_user" ON "collection_product" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_updated_by_user" ON "collection_product" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_deleted_by_user" ON "collection_product" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_product_is_active" ON "collection_product" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_is_archived" ON "collection_product" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_product_tenant" ON "collection_product" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_organization" ON "collection_product" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_collection" ON "collection_product" ("collectionId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_product_product" ON "collection_product" ("productId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_product" ON "collection_product" ("collectionId", "productId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_position" ON "collection_product" ("collectionId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_product" ADD CONSTRAINT "FK_collection_product_collection" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_product" ADD CONSTRAINT "FK_collection_product_product" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "collection_variant" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "collectionId" uuid NOT NULL, "variantId" uuid NOT NULL, "position" integer NOT NULL DEFAULT 0, "addedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_collection_variant_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_created_by_user" ON "collection_variant" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_updated_by_user" ON "collection_variant" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_deleted_by_user" ON "collection_variant" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_variant_is_active" ON "collection_variant" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_is_archived" ON "collection_variant" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_variant_tenant" ON "collection_variant" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_organization" ON "collection_variant" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_collection" ON "collection_variant" ("collectionId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_variant_variant" ON "collection_variant" ("variantId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_variant" ON "collection_variant" ("collectionId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_position" ON "collection_variant" ("collectionId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_variant" ADD CONSTRAINT "FK_collection_variant_collection" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_variant" ADD CONSTRAINT "FK_collection_variant_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "collection_channel" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "collectionId" uuid NOT NULL, "channelId" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "publishedAt" TIMESTAMP, CONSTRAINT "PK_collection_channel_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_created_by_user" ON "collection_channel" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_updated_by_user" ON "collection_channel" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_deleted_by_user" ON "collection_channel" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_is_active" ON "collection_channel" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_is_archived" ON "collection_channel" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_tenant" ON "collection_channel" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_organization" ON "collection_channel" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_collection" ON "collection_channel" ("collectionId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_channel" ON "collection_channel" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_status" ON "collection_channel" ("status")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_channel" ON "collection_channel" ("collectionId", "channelId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_listing" ON "collection_channel" ("channelId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_channel" ADD CONSTRAINT "FK_collection_channel_collection" FOREIGN KEY ("collectionId") REFERENCES "collection"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "collection_channel" ADD CONSTRAINT "FK_collection_channel_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "product_channel" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "productId" uuid NOT NULL, "channelId" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "publishedAt" TIMESTAMP, "unpublishedAt" TIMESTAMP, "sortOrder" integer NOT NULL DEFAULT 0, "isFeatured" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_product_channel_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_created_by_user" ON "product_channel" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_updated_by_user" ON "product_channel" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_deleted_by_user" ON "product_channel" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_is_active" ON "product_channel" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_is_archived" ON "product_channel" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_tenant" ON "product_channel" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_organization" ON "product_channel" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_product" ON "product_channel" ("productId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_channel" ON "product_channel" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_status" ON "product_channel" ("status")`);
		// One product is published at most once per channel.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_product_channel" ON "product_channel" ("productId", "channelId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_listing" ON "product_channel" ("channelId", "status", "isFeatured", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_org_channel" ON "product_channel" ("organizationId", "channelId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_published" ON "product_channel" ("channelId", "publishedAt") WHERE "status" = 'ACTIVE'`
		);
		await queryRunner.query(
			`ALTER TABLE "product_channel" ADD CONSTRAINT "FK_product_channel_product" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_channel" ADD CONSTRAINT "FK_product_channel_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "product_variant_channel" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "variantId" uuid NOT NULL, "channelId" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'DRAFT', "publishedAt" TIMESTAMP, "unpublishedAt" TIMESTAMP, "sortOrder" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_product_variant_channel_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_created_by_user" ON "product_variant_channel" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_updated_by_user" ON "product_variant_channel" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_deleted_by_user" ON "product_variant_channel" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_is_active" ON "product_variant_channel" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_is_archived" ON "product_variant_channel" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_tenant" ON "product_variant_channel" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_organization" ON "product_variant_channel" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_variant" ON "product_variant_channel" ("variantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_channel" ON "product_variant_channel" ("channelId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_status" ON "product_variant_channel" ("status")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_variant_channel" ON "product_variant_channel" ("variantId", "channelId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_variant_channel_listing" ON "product_variant_channel" ("channelId", "status", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_channel" ADD CONSTRAINT "FK_product_variant_channel_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_channel" ADD CONSTRAINT "FK_product_variant_channel_channel" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "product_relation" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "productId" uuid NOT NULL, "relatedProductId" uuid NOT NULL, "type" character varying(16) NOT NULL DEFAULT 'RELATED', "position" integer NOT NULL DEFAULT 0, CONSTRAINT "PK_product_relation_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_created_by_user" ON "product_relation" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_updated_by_user" ON "product_relation" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_deleted_by_user" ON "product_relation" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_is_active" ON "product_relation" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_is_archived" ON "product_relation" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_tenant" ON "product_relation" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_organization" ON "product_relation" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_product" ON "product_relation" ("productId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_related_product" ON "product_relation" ("relatedProductId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_type" ON "product_relation" ("type")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_product_relation" ON "product_relation" ("productId", "relatedProductId", "type") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_source" ON "product_relation" ("productId", "type", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_target" ON "product_relation" ("relatedProductId")`
		);
		await queryRunner.query(
			`ALTER TABLE "product_relation" ADD CONSTRAINT "CHK_product_relation_not_self" CHECK ("productId" <> "relatedProductId")`
		);
		await queryRunner.query(
			`ALTER TABLE "product_relation" ADD CONSTRAINT "FK_product_relation_product" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_relation" ADD CONSTRAINT "FK_product_relation_related_product" FOREIGN KEY ("relatedProductId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE "product_variant_media" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "variantId" uuid NOT NULL, "imageAssetId" uuid NOT NULL, "position" integer NOT NULL DEFAULT 0, "isPrimary" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_product_variant_media_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_created_by_user" ON "product_variant_media" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_updated_by_user" ON "product_variant_media" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_deleted_by_user" ON "product_variant_media" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_is_active" ON "product_variant_media" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_is_archived" ON "product_variant_media" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_variant_media_tenant" ON "product_variant_media" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_organization" ON "product_variant_media" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_variant" ON "product_variant_media" ("variantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_asset" ON "product_variant_media" ("imageAssetId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_variant_media" ON "product_variant_media" ("variantId", "imageAssetId") WHERE "deletedAt" IS NULL`
		);
		// At most one thumbnail per variant. The predicate is a boolean, so on MySQL this rule is
		// enforced by the service and verified by the nightly uniqueness audit rather than by an index.
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_variant_media_primary" ON "product_variant_media" ("variantId") WHERE "isPrimary" = true AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_variant_media_position" ON "product_variant_media" ("variantId", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_media" ADD CONSTRAINT "FK_product_variant_media_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_media" ADD CONSTRAINT "FK_product_variant_media_asset" FOREIGN KEY ("imageAssetId") REFERENCES "image_asset"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		// The facet pivot. Its uniqueness is deliberately NOT filtered by `deletedAt`: a soft-deleted
		// join row would keep a facet attached as far as every existing tag query is concerned, so a
		// facet is removed by deleting the pair, and the index is what makes that necessary.
		await queryRunner.query(
			`CREATE TABLE "tag_product_variant" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "productVariantId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_tag_product_variant_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_created_by_user" ON "tag_product_variant" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_updated_by_user" ON "tag_product_variant" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_deleted_by_user" ON "tag_product_variant" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tag_product_variant_is_active" ON "tag_product_variant" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_is_archived" ON "tag_product_variant" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tag_product_variant_tenant" ON "tag_product_variant" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_organization" ON "tag_product_variant" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_variant" ON "tag_product_variant" ("productVariantId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tag_product_variant_tag" ON "tag_product_variant" ("tagId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_tag_product_variant" ON "tag_product_variant" ("productVariantId", "tagId")`
		);
		await queryRunner.query(
			`ALTER TABLE "tag_product_variant" ADD CONSTRAINT "FK_tag_product_variant_variant" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "tag_product_variant" ADD CONSTRAINT "FK_tag_product_variant_tag" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "tag_product_variant" DROP CONSTRAINT "FK_tag_product_variant_tag"`);
		await queryRunner.query(`ALTER TABLE "tag_product_variant" DROP CONSTRAINT "FK_tag_product_variant_variant"`);
		await queryRunner.query(`DROP TABLE "tag_product_variant"`);

		await queryRunner.query(`ALTER TABLE "product_variant_media" DROP CONSTRAINT "FK_product_variant_media_asset"`);
		await queryRunner.query(
			`ALTER TABLE "product_variant_media" DROP CONSTRAINT "FK_product_variant_media_variant"`
		);
		await queryRunner.query(`DROP TABLE "product_variant_media"`);

		await queryRunner.query(
			`ALTER TABLE "product_relation" DROP CONSTRAINT "FK_product_relation_related_product"`
		);
		await queryRunner.query(`ALTER TABLE "product_relation" DROP CONSTRAINT "FK_product_relation_product"`);
		await queryRunner.query(`ALTER TABLE "product_relation" DROP CONSTRAINT "CHK_product_relation_not_self"`);
		await queryRunner.query(`DROP TABLE "product_relation"`);

		await queryRunner.query(
			`ALTER TABLE "product_variant_channel" DROP CONSTRAINT "FK_product_variant_channel_channel"`
		);
		await queryRunner.query(
			`ALTER TABLE "product_variant_channel" DROP CONSTRAINT "FK_product_variant_channel_variant"`
		);
		await queryRunner.query(`DROP TABLE "product_variant_channel"`);

		await queryRunner.query(`ALTER TABLE "product_channel" DROP CONSTRAINT "FK_product_channel_channel"`);
		await queryRunner.query(`ALTER TABLE "product_channel" DROP CONSTRAINT "FK_product_channel_product"`);
		await queryRunner.query(`DROP TABLE "product_channel"`);

		await queryRunner.query(`ALTER TABLE "collection_channel" DROP CONSTRAINT "FK_collection_channel_channel"`);
		await queryRunner.query(`ALTER TABLE "collection_channel" DROP CONSTRAINT "FK_collection_channel_collection"`);
		await queryRunner.query(`DROP TABLE "collection_channel"`);

		await queryRunner.query(`ALTER TABLE "collection_variant" DROP CONSTRAINT "FK_collection_variant_variant"`);
		await queryRunner.query(`ALTER TABLE "collection_variant" DROP CONSTRAINT "FK_collection_variant_collection"`);
		await queryRunner.query(`DROP TABLE "collection_variant"`);

		await queryRunner.query(`ALTER TABLE "collection_product" DROP CONSTRAINT "FK_collection_product_product"`);
		await queryRunner.query(`ALTER TABLE "collection_product" DROP CONSTRAINT "FK_collection_product_collection"`);
		await queryRunner.query(`DROP TABLE "collection_product"`);

		await queryRunner.query(
			`ALTER TABLE "collection_closure" DROP CONSTRAINT "FK_collection_closure_descendant"`
		);
		await queryRunner.query(`ALTER TABLE "collection_closure" DROP CONSTRAINT "FK_collection_closure_ancestor"`);
		await queryRunner.query(`DROP TABLE "collection_closure"`);

		await queryRunner.query(`ALTER TABLE "collection" DROP CONSTRAINT "FK_collection_customer"`);
		await queryRunner.query(`ALTER TABLE "collection" DROP CONSTRAINT "FK_collection_parent"`);
		await queryRunner.query(`ALTER TABLE "collection" DROP CONSTRAINT "FK_collection_image"`);
		await queryRunner.query(`DROP TABLE "collection"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "collection" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "name" varchar(255) NOT NULL, "slug" varchar(255) NOT NULL, "description" text, "type" varchar(16) NOT NULL DEFAULT ('MANUAL'), "imageId" varchar, "parentId" varchar, "sortOrder" integer NOT NULL DEFAULT (0), "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "startsAt" datetime, "endsAt" datetime, "isFeatured" boolean NOT NULL DEFAULT (0), "customerId" varchar, "metadata" text)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_created_by_user" ON "collection" ("createdByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_updated_by_user" ON "collection" ("updatedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_deleted_by_user" ON "collection" ("deletedByUserId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_is_active" ON "collection" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_is_archived" ON "collection" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_tenant" ON "collection" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_organization" ON "collection" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_slug" ON "collection" ("slug")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_type" ON "collection" ("type")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_status" ON "collection" ("status")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_image" ON "collection" ("imageId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_parent" ON "collection" ("parentId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_customer" ON "collection" ("customerId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_org_slug" ON "collection" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "slug") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_customer_slug" ON "collection" ("customerId", "slug") WHERE "customerId" IS NOT NULL AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_org_status" ON "collection" ("organizationId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_parent_sort" ON "collection" ("parentId", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_window" ON "collection" ("status", "startsAt", "endsAt") WHERE "status" = 'ACTIVE'`
		);

		await queryRunner.query(
			`CREATE TABLE "collection_closure" ("id_ancestor" varchar NOT NULL, "id_descendant" varchar NOT NULL, CONSTRAINT "PK_collection_closure" PRIMARY KEY ("id_ancestor", "id_descendant"), CONSTRAINT "FK_collection_closure_ancestor" FOREIGN KEY ("id_ancestor") REFERENCES "collection" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_collection_closure_descendant" FOREIGN KEY ("id_descendant") REFERENCES "collection" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_closure_ancestor" ON "collection_closure" ("id_ancestor")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_closure_descendant" ON "collection_closure" ("id_descendant")`
		);

		await queryRunner.query(
			`CREATE TABLE "collection_product" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "collectionId" varchar NOT NULL, "productId" varchar NOT NULL, "position" integer NOT NULL DEFAULT (0), "addedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_collection_product_collection" FOREIGN KEY ("collectionId") REFERENCES "collection" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_collection_product_product" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_created_by_user" ON "collection_product" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_updated_by_user" ON "collection_product" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_deleted_by_user" ON "collection_product" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_product_is_active" ON "collection_product" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_is_archived" ON "collection_product" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_product_tenant" ON "collection_product" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_organization" ON "collection_product" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_collection" ON "collection_product" ("collectionId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_product_product" ON "collection_product" ("productId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_product" ON "collection_product" ("collectionId", "productId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_product_position" ON "collection_product" ("collectionId", "position") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "collection_variant" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "collectionId" varchar NOT NULL, "variantId" varchar NOT NULL, "position" integer NOT NULL DEFAULT (0), "addedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_collection_variant_collection" FOREIGN KEY ("collectionId") REFERENCES "collection" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_collection_variant_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_created_by_user" ON "collection_variant" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_updated_by_user" ON "collection_variant" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_deleted_by_user" ON "collection_variant" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_variant_is_active" ON "collection_variant" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_is_archived" ON "collection_variant" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_variant_tenant" ON "collection_variant" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_organization" ON "collection_variant" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_collection" ON "collection_variant" ("collectionId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_variant_variant" ON "collection_variant" ("variantId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_variant" ON "collection_variant" ("collectionId", "variantId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_variant_position" ON "collection_variant" ("collectionId", "position") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "collection_channel" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "collectionId" varchar NOT NULL, "channelId" varchar NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "publishedAt" datetime, CONSTRAINT "FK_collection_channel_collection" FOREIGN KEY ("collectionId") REFERENCES "collection" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_collection_channel_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_created_by_user" ON "collection_channel" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_updated_by_user" ON "collection_channel" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_deleted_by_user" ON "collection_channel" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_is_active" ON "collection_channel" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_is_archived" ON "collection_channel" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_tenant" ON "collection_channel" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_organization" ON "collection_channel" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_collection" ON "collection_channel" ("collectionId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_channel" ON "collection_channel" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_collection_channel_status" ON "collection_channel" ("status")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_collection_channel" ON "collection_channel" ("collectionId", "channelId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_collection_channel_listing" ON "collection_channel" ("channelId", "status") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "product_channel" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "productId" varchar NOT NULL, "channelId" varchar NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "publishedAt" datetime, "unpublishedAt" datetime, "sortOrder" integer NOT NULL DEFAULT (0), "isFeatured" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_product_channel_product" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_product_channel_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_created_by_user" ON "product_channel" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_updated_by_user" ON "product_channel" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_deleted_by_user" ON "product_channel" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_is_active" ON "product_channel" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_is_archived" ON "product_channel" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_tenant" ON "product_channel" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_organization" ON "product_channel" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_product" ON "product_channel" ("productId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_channel" ON "product_channel" ("channelId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_channel_status" ON "product_channel" ("status")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_product_channel" ON "product_channel" ("productId", "channelId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_listing" ON "product_channel" ("channelId", "status", "isFeatured", "sortOrder") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_org_channel" ON "product_channel" ("organizationId", "channelId", "status") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_channel_published" ON "product_channel" ("channelId", "publishedAt") WHERE "status" = 'ACTIVE'`
		);

		await queryRunner.query(
			`CREATE TABLE "product_variant_channel" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "variantId" varchar NOT NULL, "channelId" varchar NOT NULL, "status" varchar(16) NOT NULL DEFAULT ('DRAFT'), "publishedAt" datetime, "unpublishedAt" datetime, "sortOrder" integer NOT NULL DEFAULT (0), CONSTRAINT "FK_product_variant_channel_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_product_variant_channel_channel" FOREIGN KEY ("channelId") REFERENCES "channel" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_created_by_user" ON "product_variant_channel" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_updated_by_user" ON "product_variant_channel" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_deleted_by_user" ON "product_variant_channel" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_is_active" ON "product_variant_channel" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_is_archived" ON "product_variant_channel" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_tenant" ON "product_variant_channel" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_organization" ON "product_variant_channel" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_variant" ON "product_variant_channel" ("variantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_channel" ON "product_variant_channel" ("channelId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_channel_status" ON "product_variant_channel" ("status")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_variant_channel" ON "product_variant_channel" ("variantId", "channelId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_variant_channel_listing" ON "product_variant_channel" ("channelId", "status", "sortOrder") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "product_relation" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "productId" varchar NOT NULL, "relatedProductId" varchar NOT NULL, "type" varchar(16) NOT NULL DEFAULT ('RELATED'), "position" integer NOT NULL DEFAULT (0), CONSTRAINT "CHK_product_relation_not_self" CHECK ("productId" <> "relatedProductId"), CONSTRAINT "FK_product_relation_product" FOREIGN KEY ("productId") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_product_relation_related_product" FOREIGN KEY ("relatedProductId") REFERENCES "product" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_created_by_user" ON "product_relation" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_updated_by_user" ON "product_relation" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_deleted_by_user" ON "product_relation" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_is_active" ON "product_relation" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_is_archived" ON "product_relation" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_tenant" ON "product_relation" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_organization" ON "product_relation" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_product" ON "product_relation" ("productId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_related_product" ON "product_relation" ("relatedProductId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_relation_type" ON "product_relation" ("type")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_product_relation" ON "product_relation" ("productId", "relatedProductId", "type") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_source" ON "product_relation" ("productId", "type", "position") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_relation_target" ON "product_relation" ("relatedProductId")`
		);

		await queryRunner.query(
			`CREATE TABLE "product_variant_media" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "variantId" varchar NOT NULL, "imageAssetId" varchar NOT NULL, "position" integer NOT NULL DEFAULT (0), "isPrimary" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_product_variant_media_variant" FOREIGN KEY ("variantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_product_variant_media_asset" FOREIGN KEY ("imageAssetId") REFERENCES "image_asset" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_created_by_user" ON "product_variant_media" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_updated_by_user" ON "product_variant_media" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_deleted_by_user" ON "product_variant_media" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_is_active" ON "product_variant_media" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_is_archived" ON "product_variant_media" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_product_variant_media_tenant" ON "product_variant_media" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_organization" ON "product_variant_media" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_variant" ON "product_variant_media" ("variantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_product_variant_media_asset" ON "product_variant_media" ("imageAssetId")`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_variant_media" ON "product_variant_media" ("variantId", "imageAssetId") WHERE "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_variant_media_primary" ON "product_variant_media" ("variantId") WHERE "isPrimary" = 1 AND "deletedAt" IS NULL`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_variant_media_position" ON "product_variant_media" ("variantId", "position") WHERE "deletedAt" IS NULL`
		);

		await queryRunner.query(
			`CREATE TABLE "tag_product_variant" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "productVariantId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_tag_product_variant_variant" FOREIGN KEY ("productVariantId") REFERENCES "product_variant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_tag_product_variant_tag" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_created_by_user" ON "tag_product_variant" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_updated_by_user" ON "tag_product_variant" ("updatedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_deleted_by_user" ON "tag_product_variant" ("deletedByUserId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tag_product_variant_is_active" ON "tag_product_variant" ("isActive")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_is_archived" ON "tag_product_variant" ("isArchived")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tag_product_variant_tenant" ON "tag_product_variant" ("tenantId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_organization" ON "tag_product_variant" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_tag_product_variant_variant" ON "tag_product_variant" ("productVariantId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_tag_product_variant_tag" ON "tag_product_variant" ("tagId")`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "UQ_tag_product_variant" ON "tag_product_variant" ("productVariantId", "tagId")`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE "tag_product_variant"`);
		await queryRunner.query(`DROP TABLE "product_variant_media"`);
		await queryRunner.query(`DROP TABLE "product_relation"`);
		await queryRunner.query(`DROP TABLE "product_variant_channel"`);
		await queryRunner.query(`DROP TABLE "product_channel"`);
		await queryRunner.query(`DROP TABLE "collection_channel"`);
		await queryRunner.query(`DROP TABLE "collection_variant"`);
		await queryRunner.query(`DROP TABLE "collection_product"`);
		await queryRunner.query(`DROP INDEX "IDX_collection_closure_descendant"`);
		await queryRunner.query(`DROP INDEX "IDX_collection_closure_ancestor"`);
		await queryRunner.query(`DROP TABLE "collection_closure"`);
		await queryRunner.query(`DROP TABLE "collection"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`collection\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`name\` varchar(255) NOT NULL, \`slug\` varchar(255) NOT NULL, \`description\` text NULL, \`type\` varchar(16) NOT NULL DEFAULT 'MANUAL', \`imageId\` varchar(36) NULL, \`parentId\` varchar(36) NULL, \`sortOrder\` int NOT NULL DEFAULT 0, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`startsAt\` datetime NULL, \`endsAt\` datetime NULL, \`isFeatured\` tinyint NOT NULL DEFAULT 0, \`customerId\` varchar(36) NULL, \`metadata\` json NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, \`organizationKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`organizationId\`, '00000000-0000-0000-0000-000000000000')) STORED, INDEX \`IDX_collection_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_collection_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_collection_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_collection_is_active\` (\`isActive\`), INDEX \`IDX_collection_is_archived\` (\`isArchived\`), INDEX \`IDX_collection_tenant\` (\`tenantId\`), INDEX \`IDX_collection_organization\` (\`organizationId\`), INDEX \`IDX_collection_slug\` (\`slug\`), INDEX \`IDX_collection_type\` (\`type\`), INDEX \`IDX_collection_status\` (\`status\`), INDEX \`IDX_collection_image\` (\`imageId\`), INDEX \`IDX_collection_parent\` (\`parentId\`), INDEX \`IDX_collection_customer\` (\`customerId\`), INDEX \`IDX_collection_org_status\` (\`organizationId\`, \`status\`), INDEX \`IDX_collection_parent_sort\` (\`parentId\`, \`sortOrder\`), INDEX \`IDX_collection_window\` (\`status\`, \`startsAt\`, \`endsAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		// MySQL has no filtered index, so the deletion guard is expressed by the stored generated
		// `deletedKey` of each table — `'0'` while the row is live, the row's own id once it is deleted —
		// and the collection's nullable organization scope by `organizationKey`. Appending `deletedAt`
		// itself would express nothing: a unique index in MySQL exempts every tuple that contains a
		// null, and `deletedAt` is null on precisely the live rows the rule is about.
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_collection_org_slug\` ON \`collection\` (\`organizationKey\`, \`slug\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_collection_customer_slug\` ON \`collection\` (\`customerId\`, \`slug\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection\` ADD CONSTRAINT \`FK_collection_image\` FOREIGN KEY (\`imageId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection\` ADD CONSTRAINT \`FK_collection_parent\` FOREIGN KEY (\`parentId\`) REFERENCES \`collection\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection\` ADD CONSTRAINT \`FK_collection_customer\` FOREIGN KEY (\`customerId\`) REFERENCES \`organization_contact\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`collection_closure\` (\`id_ancestor\` varchar(36) NOT NULL, \`id_descendant\` varchar(36) NOT NULL, INDEX \`IDX_collection_closure_ancestor\` (\`id_ancestor\`), INDEX \`IDX_collection_closure_descendant\` (\`id_descendant\`), PRIMARY KEY (\`id_ancestor\`, \`id_descendant\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_closure\` ADD CONSTRAINT \`FK_collection_closure_ancestor\` FOREIGN KEY (\`id_ancestor\`) REFERENCES \`collection\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_closure\` ADD CONSTRAINT \`FK_collection_closure_descendant\` FOREIGN KEY (\`id_descendant\`) REFERENCES \`collection\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`collection_product\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`collectionId\` varchar(36) NOT NULL, \`productId\` varchar(36) NOT NULL, \`position\` int NOT NULL DEFAULT 0, \`addedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_collection_product_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_collection_product_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_collection_product_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_collection_product_is_active\` (\`isActive\`), INDEX \`IDX_collection_product_is_archived\` (\`isArchived\`), INDEX \`IDX_collection_product_tenant\` (\`tenantId\`), INDEX \`IDX_collection_product_organization\` (\`organizationId\`), INDEX \`IDX_collection_product_collection\` (\`collectionId\`), INDEX \`IDX_collection_product_product\` (\`productId\`), INDEX \`IDX_collection_product_position\` (\`collectionId\`, \`position\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_collection_product\` ON \`collection_product\` (\`collectionId\`, \`productId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_product\` ADD CONSTRAINT \`FK_collection_product_collection\` FOREIGN KEY (\`collectionId\`) REFERENCES \`collection\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_product\` ADD CONSTRAINT \`FK_collection_product_product\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`collection_variant\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`collectionId\` varchar(36) NOT NULL, \`variantId\` varchar(36) NOT NULL, \`position\` int NOT NULL DEFAULT 0, \`addedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_collection_variant_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_collection_variant_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_collection_variant_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_collection_variant_is_active\` (\`isActive\`), INDEX \`IDX_collection_variant_is_archived\` (\`isArchived\`), INDEX \`IDX_collection_variant_tenant\` (\`tenantId\`), INDEX \`IDX_collection_variant_organization\` (\`organizationId\`), INDEX \`IDX_collection_variant_collection\` (\`collectionId\`), INDEX \`IDX_collection_variant_variant\` (\`variantId\`), INDEX \`IDX_collection_variant_position\` (\`collectionId\`, \`position\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_collection_variant\` ON \`collection_variant\` (\`collectionId\`, \`variantId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_variant\` ADD CONSTRAINT \`FK_collection_variant_collection\` FOREIGN KEY (\`collectionId\`) REFERENCES \`collection\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_variant\` ADD CONSTRAINT \`FK_collection_variant_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`collection_channel\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`collectionId\` varchar(36) NOT NULL, \`channelId\` varchar(36) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`publishedAt\` datetime NULL, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_collection_channel_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_collection_channel_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_collection_channel_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_collection_channel_is_active\` (\`isActive\`), INDEX \`IDX_collection_channel_is_archived\` (\`isArchived\`), INDEX \`IDX_collection_channel_tenant\` (\`tenantId\`), INDEX \`IDX_collection_channel_organization\` (\`organizationId\`), INDEX \`IDX_collection_channel_collection\` (\`collectionId\`), INDEX \`IDX_collection_channel_channel\` (\`channelId\`), INDEX \`IDX_collection_channel_status\` (\`status\`), INDEX \`IDX_collection_channel_listing\` (\`channelId\`, \`status\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_collection_channel\` ON \`collection_channel\` (\`collectionId\`, \`channelId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_channel\` ADD CONSTRAINT \`FK_collection_channel_collection\` FOREIGN KEY (\`collectionId\`) REFERENCES \`collection\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_channel\` ADD CONSTRAINT \`FK_collection_channel_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`product_channel\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`productId\` varchar(36) NOT NULL, \`channelId\` varchar(36) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`publishedAt\` datetime NULL, \`unpublishedAt\` datetime NULL, \`sortOrder\` int NOT NULL DEFAULT 0, \`isFeatured\` tinyint NOT NULL DEFAULT 0, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_product_channel_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_product_channel_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_product_channel_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_product_channel_is_active\` (\`isActive\`), INDEX \`IDX_product_channel_is_archived\` (\`isArchived\`), INDEX \`IDX_product_channel_tenant\` (\`tenantId\`), INDEX \`IDX_product_channel_organization\` (\`organizationId\`), INDEX \`IDX_product_channel_product\` (\`productId\`), INDEX \`IDX_product_channel_channel\` (\`channelId\`), INDEX \`IDX_product_channel_status\` (\`status\`), INDEX \`IDX_product_channel_listing\` (\`channelId\`, \`status\`, \`isFeatured\`, \`sortOrder\`), INDEX \`IDX_product_channel_org_channel\` (\`organizationId\`, \`channelId\`, \`status\`), INDEX \`IDX_product_channel_published\` (\`channelId\`, \`publishedAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_product_channel\` ON \`product_channel\` (\`productId\`, \`channelId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_channel\` ADD CONSTRAINT \`FK_product_channel_product\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_channel\` ADD CONSTRAINT \`FK_product_channel_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`product_variant_channel\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`variantId\` varchar(36) NOT NULL, \`channelId\` varchar(36) NOT NULL, \`status\` varchar(16) NOT NULL DEFAULT 'DRAFT', \`publishedAt\` datetime NULL, \`unpublishedAt\` datetime NULL, \`sortOrder\` int NOT NULL DEFAULT 0, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_product_variant_channel_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_product_variant_channel_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_product_variant_channel_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_product_variant_channel_is_active\` (\`isActive\`), INDEX \`IDX_product_variant_channel_is_archived\` (\`isArchived\`), INDEX \`IDX_product_variant_channel_tenant\` (\`tenantId\`), INDEX \`IDX_product_variant_channel_organization\` (\`organizationId\`), INDEX \`IDX_product_variant_channel_variant\` (\`variantId\`), INDEX \`IDX_product_variant_channel_channel\` (\`channelId\`), INDEX \`IDX_product_variant_channel_status\` (\`status\`), INDEX \`IDX_variant_channel_listing\` (\`channelId\`, \`status\`, \`sortOrder\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_variant_channel\` ON \`product_variant_channel\` (\`variantId\`, \`channelId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_channel\` ADD CONSTRAINT \`FK_product_variant_channel_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_channel\` ADD CONSTRAINT \`FK_product_variant_channel_channel\` FOREIGN KEY (\`channelId\`) REFERENCES \`channel\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`product_relation\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`productId\` varchar(36) NOT NULL, \`relatedProductId\` varchar(36) NOT NULL, \`type\` varchar(16) NOT NULL DEFAULT 'RELATED', \`position\` int NOT NULL DEFAULT 0, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_product_relation_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_product_relation_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_product_relation_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_product_relation_is_active\` (\`isActive\`), INDEX \`IDX_product_relation_is_archived\` (\`isArchived\`), INDEX \`IDX_product_relation_tenant\` (\`tenantId\`), INDEX \`IDX_product_relation_organization\` (\`organizationId\`), INDEX \`IDX_product_relation_product\` (\`productId\`), INDEX \`IDX_product_relation_related_product\` (\`relatedProductId\`), INDEX \`IDX_product_relation_type\` (\`type\`), INDEX \`IDX_product_relation_source\` (\`productId\`, \`type\`, \`position\`), INDEX \`IDX_product_relation_target\` (\`relatedProductId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_product_relation\` ON \`product_relation\` (\`productId\`, \`relatedProductId\`, \`type\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_relation\` ADD CONSTRAINT \`FK_product_relation_product\` FOREIGN KEY (\`productId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_relation\` ADD CONSTRAINT \`FK_product_relation_related_product\` FOREIGN KEY (\`relatedProductId\`) REFERENCES \`product\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`product_variant_media\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`variantId\` varchar(36) NOT NULL, \`imageAssetId\` varchar(36) NOT NULL, \`position\` int NOT NULL DEFAULT 0, \`isPrimary\` tinyint NOT NULL DEFAULT 0, \`deletedKey\` varchar(36) GENERATED ALWAYS AS (IF(\`deletedAt\` IS NULL, '0', \`id\`)) STORED, INDEX \`IDX_product_variant_media_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_product_variant_media_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_product_variant_media_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_product_variant_media_is_active\` (\`isActive\`), INDEX \`IDX_product_variant_media_is_archived\` (\`isArchived\`), INDEX \`IDX_product_variant_media_tenant\` (\`tenantId\`), INDEX \`IDX_product_variant_media_organization\` (\`organizationId\`), INDEX \`IDX_product_variant_media_variant\` (\`variantId\`), INDEX \`IDX_product_variant_media_asset\` (\`imageAssetId\`), INDEX \`IDX_variant_media_position\` (\`variantId\`, \`position\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_variant_media\` ON \`product_variant_media\` (\`variantId\`, \`imageAssetId\`, \`deletedKey\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_media\` ADD CONSTRAINT \`FK_product_variant_media_variant\` FOREIGN KEY (\`variantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_media\` ADD CONSTRAINT \`FK_product_variant_media_asset\` FOREIGN KEY (\`imageAssetId\`) REFERENCES \`image_asset\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		await queryRunner.query(
			`CREATE TABLE \`tag_product_variant\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`organizationId\` varchar(36) NULL, \`productVariantId\` varchar(36) NOT NULL, \`tagId\` varchar(36) NOT NULL, INDEX \`IDX_tag_product_variant_created_by_user\` (\`createdByUserId\`), INDEX \`IDX_tag_product_variant_updated_by_user\` (\`updatedByUserId\`), INDEX \`IDX_tag_product_variant_deleted_by_user\` (\`deletedByUserId\`), INDEX \`IDX_tag_product_variant_is_active\` (\`isActive\`), INDEX \`IDX_tag_product_variant_is_archived\` (\`isArchived\`), INDEX \`IDX_tag_product_variant_tenant\` (\`tenantId\`), INDEX \`IDX_tag_product_variant_organization\` (\`organizationId\`), INDEX \`IDX_tag_product_variant_variant\` (\`productVariantId\`), INDEX \`IDX_tag_product_variant_tag\` (\`tagId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`UQ_tag_product_variant\` ON \`tag_product_variant\` (\`productVariantId\`, \`tagId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_product_variant\` ADD CONSTRAINT \`FK_tag_product_variant_variant\` FOREIGN KEY (\`productVariantId\`) REFERENCES \`product_variant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_product_variant\` ADD CONSTRAINT \`FK_tag_product_variant_tag\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`tag_product_variant\` DROP FOREIGN KEY \`FK_tag_product_variant_tag\``
		);
		await queryRunner.query(
			`ALTER TABLE \`tag_product_variant\` DROP FOREIGN KEY \`FK_tag_product_variant_variant\``
		);
		await queryRunner.query(`DROP TABLE \`tag_product_variant\``);

		await queryRunner.query(
			`ALTER TABLE \`product_variant_media\` DROP FOREIGN KEY \`FK_product_variant_media_asset\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_media\` DROP FOREIGN KEY \`FK_product_variant_media_variant\``
		);
		await queryRunner.query(`DROP TABLE \`product_variant_media\``);

		await queryRunner.query(
			`ALTER TABLE \`product_relation\` DROP FOREIGN KEY \`FK_product_relation_related_product\``
		);
		await queryRunner.query(`ALTER TABLE \`product_relation\` DROP FOREIGN KEY \`FK_product_relation_product\``);
		await queryRunner.query(`DROP TABLE \`product_relation\``);

		await queryRunner.query(
			`ALTER TABLE \`product_variant_channel\` DROP FOREIGN KEY \`FK_product_variant_channel_channel\``
		);
		await queryRunner.query(
			`ALTER TABLE \`product_variant_channel\` DROP FOREIGN KEY \`FK_product_variant_channel_variant\``
		);
		await queryRunner.query(`DROP TABLE \`product_variant_channel\``);

		await queryRunner.query(`ALTER TABLE \`product_channel\` DROP FOREIGN KEY \`FK_product_channel_channel\``);
		await queryRunner.query(`ALTER TABLE \`product_channel\` DROP FOREIGN KEY \`FK_product_channel_product\``);
		await queryRunner.query(`DROP TABLE \`product_channel\``);

		await queryRunner.query(
			`ALTER TABLE \`collection_channel\` DROP FOREIGN KEY \`FK_collection_channel_channel\``
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_channel\` DROP FOREIGN KEY \`FK_collection_channel_collection\``
		);
		await queryRunner.query(`DROP TABLE \`collection_channel\``);

		await queryRunner.query(
			`ALTER TABLE \`collection_variant\` DROP FOREIGN KEY \`FK_collection_variant_variant\``
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_variant\` DROP FOREIGN KEY \`FK_collection_variant_collection\``
		);
		await queryRunner.query(`DROP TABLE \`collection_variant\``);

		await queryRunner.query(
			`ALTER TABLE \`collection_product\` DROP FOREIGN KEY \`FK_collection_product_product\``
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_product\` DROP FOREIGN KEY \`FK_collection_product_collection\``
		);
		await queryRunner.query(`DROP TABLE \`collection_product\``);

		await queryRunner.query(
			`ALTER TABLE \`collection_closure\` DROP FOREIGN KEY \`FK_collection_closure_descendant\``
		);
		await queryRunner.query(
			`ALTER TABLE \`collection_closure\` DROP FOREIGN KEY \`FK_collection_closure_ancestor\``
		);
		await queryRunner.query(`DROP TABLE \`collection_closure\``);

		await queryRunner.query(`ALTER TABLE \`collection\` DROP FOREIGN KEY \`FK_collection_customer\``);
		await queryRunner.query(`ALTER TABLE \`collection\` DROP FOREIGN KEY \`FK_collection_parent\``);
		await queryRunner.query(`ALTER TABLE \`collection\` DROP FOREIGN KEY \`FK_collection_image\``);
		await queryRunner.query(`DROP TABLE \`collection\``);
	}
}
