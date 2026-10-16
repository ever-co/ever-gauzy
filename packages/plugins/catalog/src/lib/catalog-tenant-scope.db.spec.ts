/**
 * The catalogue's set writes, run against a real database holding two tenants (review R2-19, R2-20).
 *
 * A set write replaces what a subject — a variant, a product, a collection — carries: its channel
 * publications, its gallery, its facets. Each one read the subject's existing rows by the subject's id alone,
 * then deleted the rows missing from the new set by id and updated the rest by id. A caller of tenant A who
 * named tenant B's variant therefore deleted B's publications, gallery or facets; naming B's product in
 * `setPublication` archived B's live listing. The service suites beside this one run over in-memory doubles
 * that know nothing of a tenant, so none of them could see it. `CollectionProduct` and `CollectionVariant` were
 * fixed for exactly this before; these five were not.
 *
 * **Nothing the defect lives in is doubled here.** The services are the real ones over TypeORM repositories of
 * an in-memory better-sqlite3 database with the production `invalidWhereValuesBehavior`. Tenant B's rows are
 * written through the same services while the request context says B; tenant A then attacks them, and every
 * case reads B's rows back afterwards. Each write has a control: the same call, on A's own subject, still works.
 *
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites give (its barrel
 * boots the whole application); the members a set write depends on for behaviour — the repositories, the
 * database and the request context's two readers — are real or answer with the caller each case states.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}
	}

	return {
		TenantAwareCrudService,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		BaseEvent: class {},
		EventBus: class {},
		Product: class Product {},
		ProductVariant: class ProductVariant {},
		Tag: class Tag {},
		ImageAsset: class ImageAsset {},
		OrganizationContact: class OrganizationContact {},
		Warehouse: class Warehouse {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

/**
 * `@gauzy/config`'s barrel reads the process environment at import time; the production
 * `invalidWhereValuesBehavior` is taken from the module that declares it.
 */
jest.mock('@gauzy/config', () => jest.requireActual('@gauzy/config/src/lib/database-helpers'));

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { EventBus, ImageAsset, Product, ProductVariant, Tag } from '@gauzy/core';
import { CollectionProduct } from './collection-product/collection-product.entity';
import { CollectionProductService } from './collection-product/collection-product.service';
import { CollectionVariant } from './collection-variant/collection-variant.entity';
import { CollectionVariantService } from './collection-variant/collection-variant.service';
import { PublicationStatus } from './catalog.types';
import { CollectionChannel } from './collection-channel/collection-channel.entity';
import { CollectionChannelService } from './collection-channel/collection-channel.service';
import { Collection } from './collection/collection.entity';
import { ProductChannel } from './product-channel/product-channel.entity';
import { ProductChannelService } from './product-channel/product-channel.service';
import { ProductVariantChannel } from './product-variant-channel/product-variant-channel.entity';
import { ProductVariantChannelService } from './product-variant-channel/product-variant-channel.service';
import { ProductVariantMedia } from './product-variant-media/product-variant-media.entity';
import { ProductVariantMediaService } from './product-variant-media/product-variant-media.service';
import { TagProductVariant } from './tag-product-variant/tag-product-variant.entity';
import { TagProductVariantService } from './tag-product-variant/tag-product-variant.service';

type Row = Record<string, any>;

/** Tenant A — the caller — and tenant B, whose rows A must not reach. */
const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

/** One product, variant, collection, channel, two images and a facet value per tenant. */
const PRODUCT_A = '00000000-0000-4000-8000-0000000001a1';
const PRODUCT_B = '00000000-0000-4000-8000-0000000001b1';
const VARIANT_A = '00000000-0000-4000-8000-0000000002a1';
const VARIANT_B = '00000000-0000-4000-8000-0000000002b1';
const COLLECTION_A = '00000000-0000-4000-8000-0000000003a1';
const COLLECTION_B = '00000000-0000-4000-8000-0000000003b1';
const CHANNEL_A = '00000000-0000-4000-8000-0000000004a1';
const CHANNEL_B = '00000000-0000-4000-8000-0000000004b1';
const IMAGE_A1 = '00000000-0000-4000-8000-0000000005a1';
const IMAGE_A2 = '00000000-0000-4000-8000-0000000005a2';
const IMAGE_B1 = '00000000-0000-4000-8000-0000000005b1';
const IMAGE_B2 = '00000000-0000-4000-8000-0000000005b2';
const TAG_A = '00000000-0000-4000-8000-0000000006a1';
const TAG_B = '00000000-0000-4000-8000-0000000006b1';
const TAG_GLOBAL = '00000000-0000-4000-8000-0000000006c1';

/** A second organization of tenant A, and a third tenant that happens to carry A's organization id. */
const ORG_A2 = '00000000-0000-4000-8000-0000000000a2';
const TENANT_C = '00000000-0000-4000-8000-00000000000c';

/** Tenant A's rows outside organization A: organization A2's, and the tenant's organization-less ones. */
const PRODUCT_A2 = '00000000-0000-4000-8000-0000000001a2';
const VARIANT_A2 = '00000000-0000-4000-8000-0000000002a2';
const TAG_A2 = '00000000-0000-4000-8000-0000000006a2';
const IMAGE_A2_ORG = '00000000-0000-4000-8000-0000000005a3';
const TAG_A_TENANT = '00000000-0000-4000-8000-0000000006a0';
const IMAGE_A_TENANT = '00000000-0000-4000-8000-0000000005a0';

/*
|--------------------------------------------------------------------------
| Fixture schemas: the columns the services read and write
|--------------------------------------------------------------------------
*/

const base = () => ({
	id: { type: 'varchar', primary: true, generated: 'uuid' },
	createdAt: { type: 'datetime', createDate: true },
	updatedAt: { type: 'datetime', updateDate: true },
	deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
	tenantId: { type: 'varchar', nullable: true },
	organizationId: { type: 'varchar', nullable: true }
});

const optionalDate = { type: 'datetime', nullable: true } as const;

const schemas = [
	new EntitySchema<any>({ name: 'Product', target: Product, tableName: 'product', columns: { ...(base() as any) } }),
	new EntitySchema<any>({
		name: 'ProductVariant',
		target: ProductVariant,
		tableName: 'product_variant',
		columns: { ...(base() as any), productId: { type: 'varchar', nullable: true } }
	}),
	new EntitySchema<any>({
		name: 'Collection',
		target: Collection,
		tableName: 'collection',
		columns: { ...(base() as any), name: { type: 'varchar', nullable: true } }
	}),
	new EntitySchema<any>({
		name: 'ProductVariantChannel',
		target: ProductVariantChannel,
		tableName: 'product_variant_channel',
		columns: {
			...(base() as any),
			variantId: { type: 'varchar' },
			channelId: { type: 'varchar' },
			status: { type: 'varchar' },
			publishedAt: optionalDate,
			unpublishedAt: optionalDate,
			sortOrder: { type: 'int', default: 0 }
		}
	}),
	new EntitySchema<any>({
		name: 'CollectionChannel',
		target: CollectionChannel,
		tableName: 'collection_channel',
		columns: {
			...(base() as any),
			collectionId: { type: 'varchar' },
			channelId: { type: 'varchar' },
			status: { type: 'varchar' },
			publishedAt: optionalDate
		}
	}),
	new EntitySchema<any>({
		name: 'ProductVariantMedia',
		target: ProductVariantMedia,
		tableName: 'product_variant_media',
		columns: {
			...(base() as any),
			variantId: { type: 'varchar' },
			imageAssetId: { type: 'varchar' },
			position: { type: 'int', default: 0 },
			isPrimary: { type: 'boolean', default: false }
		}
	}),
	new EntitySchema<any>({
		name: 'TagProductVariant',
		target: TagProductVariant,
		tableName: 'tag_product_variant',
		columns: {
			...(base() as any),
			productVariantId: { type: 'varchar' },
			tagId: { type: 'varchar' }
		},
		relations: {
			// `findByVariant` loads the facet value with each row.
			tag: {
				type: 'many-to-one',
				target: 'Tag',
				joinColumn: { name: 'tagId' },
				createForeignKeyConstraints: false
			}
		}
	}),
	new EntitySchema<any>({
		name: 'Tag',
		target: Tag,
		tableName: 'tag',
		columns: { ...(base() as any), name: { type: 'varchar', nullable: true } }
	}),
	new EntitySchema<any>({ name: 'ImageAsset', target: ImageAsset, tableName: 'image_asset', columns: { ...(base() as any) } }),
	new EntitySchema<any>({
		name: 'CollectionProduct',
		target: CollectionProduct,
		tableName: 'collection_product',
		columns: {
			...(base() as any),
			collectionId: { type: 'varchar' },
			productId: { type: 'varchar' },
			position: { type: 'int', default: 0 },
			addedAt: { type: 'datetime', createDate: true }
		},
		relations: { product: { type: 'many-to-one', target: 'Product', joinColumn: { name: 'productId' }, createForeignKeyConstraints: false } }
	}),
	new EntitySchema<any>({
		name: 'CollectionVariant',
		target: CollectionVariant,
		tableName: 'collection_variant',
		columns: {
			...(base() as any),
			collectionId: { type: 'varchar' },
			variantId: { type: 'varchar' },
			position: { type: 'int', default: 0 },
			addedAt: { type: 'datetime', createDate: true }
		},
		relations: { variant: { type: 'many-to-one', target: 'ProductVariant', joinColumn: { name: 'variantId' }, createForeignKeyConstraints: false } }
	}),
	new EntitySchema<any>({
		name: 'ProductChannel',
		target: ProductChannel,
		tableName: 'product_channel',
		columns: {
			...(base() as any),
			productId: { type: 'varchar' },
			channelId: { type: 'varchar' },
			status: { type: 'varchar' },
			publishedAt: optionalDate,
			unpublishedAt: optionalDate,
			sortOrder: { type: 'int', default: 0 },
			isFeatured: { type: 'boolean', default: false }
		}
	})
];

/*
|--------------------------------------------------------------------------
| Harness
|--------------------------------------------------------------------------
*/

interface IHarness {
	dataSource: DataSource;
	variantChannels: ProductVariantChannelService;
	collectionChannels: CollectionChannelService;
	media: ProductVariantMediaService;
	tags: TagProductVariantService;
	productChannels: ProductChannelService;
	collectionProducts: CollectionProductService;
	collectionVariants: CollectionVariantService;
	/** Every row of a table that belongs to one tenant, as the database holds it. */
	rowsOf: (table: string, tenantId: string) => Promise<Row[]>;
}

/** Acts as a caller of one tenant. */
function actAs(tenantId: string | null, organizationId: string | null = null): void {
	mockCaller.tenantId = tenantId;
	mockCaller.organizationId = organizationId;
}

async function harness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: schemas,
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	for (const [tenantId, organizationId, product, variant, collection, tag] of [
		[TENANT_A, ORG_A, PRODUCT_A, VARIANT_A, COLLECTION_A, TAG_A],
		[TENANT_B, ORG_B, PRODUCT_B, VARIANT_B, COLLECTION_B, TAG_B]
	]) {
		await dataSource.query(`INSERT INTO "tag" ("id", "tenantId", "organizationId") VALUES (?, ?, ?)`, [
			tag,
			tenantId,
			organizationId
		]);
		await dataSource.query(`INSERT INTO "product" ("id", "tenantId", "organizationId") VALUES (?, ?, ?)`, [
			product,
			tenantId,
			organizationId
		]);
		await dataSource.query(
			`INSERT INTO "product_variant" ("id", "productId", "tenantId", "organizationId") VALUES (?, ?, ?, ?)`,
			[variant, product, tenantId, organizationId]
		);
		await dataSource.query(`INSERT INTO "collection" ("id", "tenantId", "organizationId") VALUES (?, ?, ?)`, [
			collection,
			tenantId,
			organizationId
		]);
	}

	// Each tenant's gallery images, so a gallery names images that exist where it is written.
	for (const [image, tenantId, organizationId] of [
		[IMAGE_A1, TENANT_A, ORG_A],
		[IMAGE_A2, TENANT_A, ORG_A],
		[IMAGE_B1, TENANT_B, ORG_B],
		[IMAGE_B2, TENANT_B, ORG_B]
	]) {
		await dataSource.query(`INSERT INTO "image_asset" ("id", "tenantId", "organizationId") VALUES (?, ?, ?)`, [
			image,
			tenantId,
			organizationId
		]);
	}
	// A facet value the installation ships to every tenant.
	await dataSource.query(`INSERT INTO "tag" ("id", "tenantId", "organizationId") VALUES (?, NULL, NULL)`, [TAG_GLOBAL]);

	// Tenant A's rows outside organization A: organization A2's, and the tenant's organization-less ones.
	await dataSource.query(`INSERT INTO "product" ("id", "tenantId", "organizationId") VALUES (?, ?, ?)`, [
		PRODUCT_A2,
		TENANT_A,
		ORG_A2
	]);
	await dataSource.query(
		`INSERT INTO "product_variant" ("id", "productId", "tenantId", "organizationId") VALUES (?, ?, ?, ?)`,
		[VARIANT_A2, PRODUCT_A2, TENANT_A, ORG_A2]
	);
	for (const [table, id, organizationId] of [
		['tag', TAG_A2, ORG_A2],
		['tag', TAG_A_TENANT, null],
		['image_asset', IMAGE_A2_ORG, ORG_A2],
		['image_asset', IMAGE_A_TENANT, null]
	]) {
		await dataSource.query(`INSERT INTO "${table}" ("id", "tenantId", "organizationId") VALUES (?, ?, ?)`, [
			id,
			TENANT_A,
			organizationId
		]);
	}

	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;
	const eventBus = { publish: async () => undefined } as unknown as EventBus;

	return {
		dataSource,
		variantChannels: new ProductVariantChannelService(repository(ProductVariantChannel), undefined as any),
		collectionChannels: new CollectionChannelService(repository(CollectionChannel), undefined as any),
		media: new ProductVariantMediaService(repository(ProductVariantMedia), undefined as any),
		tags: new TagProductVariantService(repository(TagProductVariant), undefined as any),
		productChannels: new ProductChannelService(repository(ProductChannel), undefined as any, eventBus),
		collectionProducts: new CollectionProductService(repository(CollectionProduct), undefined as any),
		collectionVariants: new CollectionVariantService(repository(CollectionVariant), undefined as any),
		rowsOf: async (table, tenantId) =>
			await dataSource.query(`SELECT * FROM "${table}" WHERE "tenantId" = ? ORDER BY "id"`, [tenantId])
	};
}

describe('catalogue set writes keep to the caller’s tenant (DB-backed, two tenants)', () => {
	let h: IHarness;

	beforeEach(async () => {
		h = await harness();
	});

	afterEach(async () => {
		actAs(null);
		await h.dataSource.destroy();
	});

	describe('variant channel publications (R2-19)', () => {
		beforeEach(async () => {
			actAs(TENANT_B, ORG_B);
			await h.variantChannels.replacePublications(VARIANT_B, [
				{ channelId: CHANNEL_B, status: PublicationStatus.ACTIVE }
			]);
			actAs(TENANT_A, ORG_A);
		});

		it('refuses to replace another tenant’s variant’s publications, and deletes none of them', async () => {
			await expect(h.variantChannels.replacePublications(VARIANT_B, [])).rejects.toBeInstanceOf(
				NotFoundException
			);

			const rows = await h.rowsOf('product_variant_channel', TENANT_B);
			expect(rows.map((row) => [row.channelId, row.status])).toEqual([[CHANNEL_B, PublicationStatus.ACTIVE]]);
		});

		it('refuses to rewrite the status of another tenant’s publication', async () => {
			await expect(
				h.variantChannels.replacePublications(VARIANT_B, [
					{ channelId: CHANNEL_B, status: PublicationStatus.ARCHIVED }
				])
			).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.rowsOf('product_variant_channel', TENANT_B))[0].status).toBe(PublicationStatus.ACTIVE);
			expect(await h.rowsOf('product_variant_channel', TENANT_A)).toHaveLength(0);
		});

		it('control: the owner replaces its own variant’s publications', async () => {
			await h.variantChannels.replacePublications(VARIANT_A, [
				{ channelId: CHANNEL_A, status: PublicationStatus.ACTIVE }
			]);
			const after = await h.variantChannels.replacePublications(VARIANT_A, [
				{ channelId: CHANNEL_A, status: PublicationStatus.ARCHIVED }
			]);

			expect(after.map((row) => [row.channelId, row.status])).toEqual([[CHANNEL_A, PublicationStatus.ARCHIVED]]);
		});
	});

	describe('collection channel publications (R2-19)', () => {
		beforeEach(async () => {
			actAs(TENANT_B, ORG_B);
			await h.collectionChannels.replaceChannels(COLLECTION_B, [
				{ channelId: CHANNEL_B, status: PublicationStatus.ACTIVE }
			]);
			actAs(TENANT_A, ORG_A);
		});

		it('refuses to replace another tenant’s collection’s channels, and deletes none of them', async () => {
			await expect(h.collectionChannels.replaceChannels(COLLECTION_B, [])).rejects.toBeInstanceOf(
				NotFoundException
			);

			expect(await h.rowsOf('collection_channel', TENANT_B)).toHaveLength(1);
		});

		it('control: the owner replaces its own collection’s channels', async () => {
			const after = await h.collectionChannels.replaceChannels(COLLECTION_A, [
				{ channelId: CHANNEL_A, status: PublicationStatus.ACTIVE }
			]);

			expect(after.map((row) => row.channelId)).toEqual([CHANNEL_A]);
			expect(await h.collectionChannels.replaceChannels(COLLECTION_A, [])).toEqual([]);
		});
	});

	describe('variant galleries (R2-19)', () => {
		beforeEach(async () => {
			actAs(TENANT_B, ORG_B);
			await h.media.replaceMedia(VARIANT_B, [IMAGE_B1, IMAGE_B2], IMAGE_B1);
			actAs(TENANT_A, ORG_A);
		});

		it('refuses to replace another tenant’s gallery, and deletes none of its images', async () => {
			await expect(h.media.replaceMedia(VARIANT_B, [])).rejects.toBeInstanceOf(NotFoundException);

			expect((await h.rowsOf('product_variant_media', TENANT_B)).map((row) => row.imageAssetId).sort()).toEqual(
				[IMAGE_B1, IMAGE_B2].sort()
			);
		});

		it('refuses to detach an image from another tenant’s gallery', async () => {
			await expect(h.media.detach(VARIANT_B, IMAGE_B1)).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.rowsOf('product_variant_media', TENANT_B)).toHaveLength(2);
		});

		it('refuses to move another tenant’s thumbnail', async () => {
			await expect(h.media.setPrimary(VARIANT_B, IMAGE_B2)).rejects.toBeInstanceOf(NotFoundException);

			const primary = (await h.rowsOf('product_variant_media', TENANT_B)).filter((row) => !!row.isPrimary);
			expect(primary.map((row) => row.imageAssetId)).toEqual([IMAGE_B1]);
		});

		it('control: the owner replaces its own gallery and detaches from it', async () => {
			await h.media.replaceMedia(VARIANT_A, [IMAGE_A1, IMAGE_A2], IMAGE_A1);
			await h.media.detach(VARIANT_A, IMAGE_A1);

			const rows = await h.rowsOf('product_variant_media', TENANT_A);
			expect(rows.map((row) => [row.imageAssetId, !!row.isPrimary])).toEqual([[IMAGE_A2, true]]);
		});
	});

	describe('variant facets (R2-19)', () => {
		beforeEach(async () => {
			actAs(TENANT_B, ORG_B);
			await h.tags.replaceTags(VARIANT_B, [TAG_B]);
			actAs(TENANT_A, ORG_A);
		});

		it('refuses to replace another tenant’s variant’s facets, and deletes none of them', async () => {
			await expect(h.tags.replaceTags(VARIANT_B, [])).rejects.toBeInstanceOf(NotFoundException);

			expect(await h.rowsOf('tag_product_variant', TENANT_B)).toHaveLength(1);
		});

		it('a detach naming another tenant’s variant and facet removes nothing', async () => {
			await h.tags.detach(VARIANT_B, TAG_B).catch(() => undefined);

			expect(await h.rowsOf('tag_product_variant', TENANT_B)).toHaveLength(1);
		});

		it('control: the owner replaces and detaches its own facets', async () => {
			await h.tags.replaceTags(VARIANT_A, [TAG_A]);
			expect(await h.rowsOf('tag_product_variant', TENANT_A)).toHaveLength(1);

			await h.tags.detach(VARIANT_A, TAG_A);
			expect(await h.rowsOf('tag_product_variant', TENANT_A)).toHaveLength(0);
		});
	});

	describe('product channel publication (R2-20)', () => {
		beforeEach(async () => {
			actAs(TENANT_B, ORG_B);
			await h.productChannels.setPublication(PRODUCT_B, [CHANNEL_B], PublicationStatus.ACTIVE);
			actAs(TENANT_A, ORG_A);
		});

		it('refuses to withdraw another tenant’s live listing, and leaves it live', async () => {
			await expect(
				h.productChannels.setPublication(PRODUCT_B, [CHANNEL_B], PublicationStatus.ARCHIVED)
			).rejects.toBeInstanceOf(NotFoundException);

			const rows = await h.rowsOf('product_channel', TENANT_B);
			expect(rows.map((row) => [row.channelId, row.status, row.unpublishedAt])).toEqual([
				[CHANNEL_B, PublicationStatus.ACTIVE, null]
			]);
			expect(await h.rowsOf('product_channel', TENANT_A)).toHaveLength(0);
		});

		it('does not report another tenant’s listing as published', async () => {
			expect(await h.productChannels.isPublishedOn(PRODUCT_B, CHANNEL_B)).toBe(false);
		});

		it('control: the owner publishes and withdraws its own product', async () => {
			await h.productChannels.setPublication(PRODUCT_A, [CHANNEL_A], PublicationStatus.ACTIVE);
			expect(await h.productChannels.isPublishedOn(PRODUCT_A, CHANNEL_A)).toBe(true);

			const after = await h.productChannels.setPublication(PRODUCT_A, [CHANNEL_A], PublicationStatus.ARCHIVED);
			expect(after.map((row) => row.status)).toEqual([PublicationStatus.ARCHIVED]);
		});
	});

	/*
	 * The cases above change the tenant and the organization together, so they would stay green with either filter
	 * removed from `callerScope()`. These change one member at a time, and state the caller with no organization.
	 */
	describe('each scope member is enforced on its own', () => {
		/** Every set write of this fix, each naming one of tenant A's own subjects. */
		const writes: Array<[string, string, () => Promise<unknown>]> = [
			[
				'variant publications',
				'product_variant_channel',
				() =>
					h.variantChannels.replacePublications(VARIANT_A, [
						{ channelId: CHANNEL_A, status: PublicationStatus.ACTIVE }
					])
			],
			[
				'collection channels',
				'collection_channel',
				() =>
					h.collectionChannels.replaceChannels(COLLECTION_A, [
						{ channelId: CHANNEL_A, status: PublicationStatus.ACTIVE }
					])
			],
			['variant gallery', 'product_variant_media', () => h.media.replaceMedia(VARIANT_A, [IMAGE_A1], IMAGE_A1)],
			['variant facets', 'tag_product_variant', () => h.tags.replaceTags(VARIANT_A, [TAG_A])],
			[
				'product publication',
				'product_channel',
				() => h.productChannels.setPublication(PRODUCT_A, [CHANNEL_A], PublicationStatus.ACTIVE)
			]
		];

		it.each([
			['another organization of the same tenant', TENANT_A, ORG_A2],
			['another tenant that shares the organization id', TENANT_C, ORG_A],
			['another tenant, with no organization stated', TENANT_B, null]
		])('refuses %s, and writes nothing', async (_label, tenantId, organizationId) => {
			actAs(tenantId, organizationId);

			for (const [what, table, write] of writes) {
				await expect(write()).rejects.toBeInstanceOf(NotFoundException);
				expect({
					what,
					rows: (await h.dataSource.query(`SELECT COUNT(*) AS "n" FROM "${table}"`))[0].n
				}).toEqual({
					what,
					rows: 0
				});
			}
		});

		it('control: a caller of the tenant with no organization stated is narrowed to the tenant alone', async () => {
			actAs(TENANT_A, null);

			for (const [what, table, write] of writes) {
				await write();
				const rows = await h.rowsOf(table, TENANT_A);
				expect({ what, rows: rows.length }).toEqual({ what, rows: 1 });
			}
		});
	});

	/**
	 * SEC-D-04: the set writes checked their SUBJECT (the collection, the variant) and inserted the MEMBER ids through
	 * `manager.insert`, which no core foreign-row check sees — another tenant's product, variant, facet value or image
	 * went in by its id and was read back through the membership's relations.
	 */
	describe('the members of a set write are the caller’s rows (SEC-D-04)', () => {
		beforeEach(() => actAs(TENANT_A, ORG_A));

		it('refuses another tenant’s product in a collection, and writes no membership', async () => {
			await expect(h.collectionProducts.replaceProducts(COLLECTION_A, [PRODUCT_A, PRODUCT_B])).rejects.toBeInstanceOf(
				NotFoundException
			);
			expect(await h.rowsOf('collection_product', TENANT_A)).toEqual([]);
		});

		it('refuses another tenant’s variant in a collection, through the set write and the addition alike', async () => {
			await expect(h.collectionVariants.replaceVariants(COLLECTION_A, [VARIANT_B])).rejects.toBeInstanceOf(NotFoundException);
			await expect(h.collectionVariants.addVariants(COLLECTION_A, [VARIANT_B])).rejects.toBeInstanceOf(NotFoundException);
			expect(await h.rowsOf('collection_variant', TENANT_A)).toEqual([]);
		});

		it('refuses another tenant’s facet value, and accepts the installation’s', async () => {
			await expect(h.tags.replaceTags(VARIANT_A, [TAG_B])).rejects.toBeInstanceOf(NotFoundException);
			expect(await h.rowsOf('tag_product_variant', TENANT_A)).toEqual([]);

			await h.tags.replaceTags(VARIANT_A, [TAG_A, TAG_GLOBAL]);
			expect((await h.rowsOf('tag_product_variant', TENANT_A)).map((row) => row.tagId).sort()).toEqual([TAG_A, TAG_GLOBAL].sort());
		});

		it('refuses another tenant’s image in a gallery', async () => {
			await expect(h.media.replaceMedia(VARIANT_A, [IMAGE_A1, IMAGE_B1], IMAGE_A1)).rejects.toBeInstanceOf(NotFoundException);
			expect(await h.rowsOf('product_variant_media', TENANT_A)).toEqual([]);
		});

		it('refuses a member of another organization of the same tenant, in every set write', async () => {
			// Review on #10755: the refusals above change the tenant AND the organization, so they would still pass if
			// the member check stopped filtering by organization. Here only the organization differs.
			await expect(h.collectionProducts.replaceProducts(COLLECTION_A, [PRODUCT_A2])).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(h.collectionVariants.replaceVariants(COLLECTION_A, [VARIANT_A2])).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(h.collectionVariants.addVariants(COLLECTION_A, [VARIANT_A2])).rejects.toBeInstanceOf(
				NotFoundException
			);
			await expect(h.tags.replaceTags(VARIANT_A, [TAG_A2])).rejects.toBeInstanceOf(NotFoundException);
			await expect(h.media.replaceMedia(VARIANT_A, [IMAGE_A2_ORG], IMAGE_A2_ORG)).rejects.toBeInstanceOf(
				NotFoundException
			);

			for (const table of ['collection_product', 'collection_variant', 'tag_product_variant', 'product_variant_media']) {
				expect({ table, rows: await h.rowsOf(table, TENANT_A) }).toEqual({ table, rows: [] });
			}
		});

		it('control: accepts the tenant’s organization-less facet values and images', async () => {
			await h.tags.replaceTags(VARIANT_A, [TAG_A, TAG_A_TENANT]);
			await h.media.replaceMedia(VARIANT_A, [IMAGE_A1, IMAGE_A_TENANT], IMAGE_A1);

			expect((await h.rowsOf('tag_product_variant', TENANT_A)).map((row) => row.tagId).sort()).toEqual(
				[TAG_A, TAG_A_TENANT].sort()
			);
			expect((await h.rowsOf('product_variant_media', TENANT_A)).map((row) => row.imageAssetId).sort()).toEqual(
				[IMAGE_A1, IMAGE_A_TENANT].sort()
			);
		});

		it('control: the owner fills its collection with its own products and variants', async () => {
			await h.collectionProducts.replaceProducts(COLLECTION_A, [PRODUCT_A]);
			await h.collectionVariants.replaceVariants(COLLECTION_A, [VARIANT_A]);

			expect((await h.rowsOf('collection_product', TENANT_A)).map((row) => row.productId)).toEqual([PRODUCT_A]);
			expect((await h.rowsOf('collection_variant', TENANT_A)).map((row) => row.variantId)).toEqual([VARIANT_A]);
		});
	});
});
