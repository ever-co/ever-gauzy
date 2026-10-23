/**
 * The channel a publication row names, written against a real database holding two tenants (security audit P0 #6c).
 *
 * A product's, variant's or collection's publication row names its channel by `channelId`, a plain column. The
 * platform's cross-tenant check reads relation join columns, so it never saw the column on the generic `POST` / `PUT`
 * routes of `/product-channels`, `/product-variant-channels` and `/collection-channels`; and the set writes — `publish`
 * / `unpublish`, `by-variant`, `by-collection` and their GraphQL twins — insert through the manager, which no core
 * check sees at all. The subject of a set write was already held to the caller (review R2-19, R2-20); the channel was
 * not, so a caller of tenant A published its own products on tenant B's channel.
 *
 * **Nothing the defect lives in is doubled here.** The services are the real ones over TypeORM repositories of an
 * in-memory better-sqlite3 database with the production `invalidWhereValuesBehavior`; the channels are real rows of
 * tenant A, of tenant B and of no tenant. `@gauzy/core` is doubled at the module boundary for the reason the package's
 * other suites give, and its CRUD base is reduced to the tenant-scoped write the real one performs. Every refusal
 * reads the rows back, and every write has a control naming tenant A's own channel.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');

	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, reduced to what the real one does for these calls: the write is scoped to the caller's tenant. */
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(
				this.typeOrmRepository.create({
					...entity,
					tenantId: mockCaller.tenantId,
					organizationId: mockCaller.organizationId
				})
			);
		}

		async update(id: any, partial: any): Promise<any> {
			const where = { ...(typeof id === 'string' ? { id } : id), tenantId: mockCaller.tenantId };

			if (!(await this.typeOrmRepository.findOneBy(where))) {
				throw new NotFoundException('The requested record was not found');
			}

			return this.typeOrmRepository.update(where, partial);
		}
	}

	return {
		TenantAwareCrudService,
		// The check under test is the platform's own, not a double of it.
		assertPlainReferencesNotForeign: (...args: unknown[]) =>
			jest
				.requireActual('@gauzy/core/src/lib/core/crud/plain-reference-ownership.helper')
				.assertPlainReferencesNotForeign(...args),
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
import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { EventBus, Product, ProductVariant } from '@gauzy/core';
import { PublicationStatus } from './catalog.types';
import { CollectionChannel } from './collection-channel/collection-channel.entity';
import { CollectionChannelService } from './collection-channel/collection-channel.service';
import { Collection } from './collection/collection.entity';
import { ProductChannel } from './product-channel/product-channel.entity';
import { ProductChannelService } from './product-channel/product-channel.service';
import { ProductVariantChannel } from './product-variant-channel/product-variant-channel.entity';
import { ProductVariantChannelService } from './product-variant-channel/product-variant-channel.service';

type Row = Record<string, any>;

/** Tenant A — the caller — and tenant B, whose channels A must not publish on. */
const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const ORG_A = '00000000-0000-4000-8000-0000000000a1';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const ORG_B = '00000000-0000-4000-8000-0000000000b1';

/** Tenant A's subjects, and one channel per owner: tenant A, tenant B and no tenant. */
const PRODUCT_A = '00000000-0000-4000-8000-0000000001a1';
const VARIANT_A = '00000000-0000-4000-8000-0000000002a1';
const COLLECTION_A = '00000000-0000-4000-8000-0000000003a1';
const CHANNEL = {
	a: '00000000-0000-4000-8000-0000000004a1',
	b: '00000000-0000-4000-8000-0000000004b1',
	global: '00000000-0000-4000-8000-0000000004c1'
};

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
		columns: { ...(base() as any) }
	}),
	new EntitySchema<any>({
		name: 'Collection',
		target: Collection,
		tableName: 'collection',
		columns: { ...(base() as any) }
	}),
	new EntitySchema<any>({ name: 'ChannelRow', tableName: 'channel', columns: { ...(base() as any) } }),
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
			sortOrder: { type: 'int', default: 0 }
		}
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
	})
];

/*
|--------------------------------------------------------------------------
| Harness
|--------------------------------------------------------------------------
*/

interface IHarness {
	dataSource: DataSource;
	productChannels: ProductChannelService;
	variantChannels: ProductVariantChannelService;
	collectionChannels: CollectionChannelService;
	rows: (table: string) => Promise<Row[]>;
	row: (table: string, id: string) => Promise<Row | undefined>;
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

	for (const [table, id] of [
		['product', PRODUCT_A],
		['product_variant', VARIANT_A],
		['collection', COLLECTION_A]
	]) {
		await dataSource.query(`INSERT INTO "${table}" ("id", "tenantId", "organizationId") VALUES (?, ?, ?)`, [
			id,
			TENANT_A,
			ORG_A
		]);
	}
	await dataSource.query(
		`INSERT INTO "channel" ("id", "tenantId", "organizationId") VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
		[CHANNEL.a, TENANT_A, ORG_A, CHANNEL.b, TENANT_B, ORG_B, CHANNEL.global, null, null]
	);

	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;
	const eventBus = { publish: async () => undefined } as unknown as EventBus;

	return {
		dataSource,
		productChannels: new ProductChannelService(repository(ProductChannel), undefined as any, eventBus),
		variantChannels: new ProductVariantChannelService(repository(ProductVariantChannel), undefined as any),
		collectionChannels: new CollectionChannelService(repository(CollectionChannel), undefined as any),
		rows: (table) => dataSource.query(`SELECT * FROM "${table}"`),
		row: async (table, id) => (await dataSource.query(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0]
	};
}

/** The three publication rows: the service that writes each, and the subject a row is about. */
const PUBLICATIONS: Array<{
	table: string;
	service: (h: IHarness) => {
		create: (entity: any) => Promise<any>;
		update: (id: any, partial: any) => Promise<any>;
	};
	subject: Row;
}> = [
	{ table: 'product_channel', service: (h) => h.productChannels, subject: { productId: PRODUCT_A } },
	{ table: 'product_variant_channel', service: (h) => h.variantChannels, subject: { variantId: VARIANT_A } },
	{ table: 'collection_channel', service: (h) => h.collectionChannels, subject: { collectionId: COLLECTION_A } }
];

/** The set writes, each naming the channels it is given. */
const SET_WRITES: Array<{ name: string; table: string; write: (h: IHarness, channelId: string) => Promise<unknown> }> =
	[
		{
			name: 'ProductChannelService.setPublication',
			table: 'product_channel',
			write: (h, channelId) => h.productChannels.setPublication(PRODUCT_A, [channelId], PublicationStatus.ACTIVE)
		},
		{
			name: 'ProductVariantChannelService.replacePublications',
			table: 'product_variant_channel',
			write: (h, channelId) =>
				h.variantChannels.replacePublications(VARIANT_A, [{ channelId, status: PublicationStatus.ACTIVE }])
		},
		{
			name: 'CollectionChannelService.replaceChannels',
			table: 'collection_channel',
			write: (h, channelId) =>
				h.collectionChannels.replaceChannels(COLLECTION_A, [{ channelId, status: PublicationStatus.ACTIVE }])
		}
	];

describe('catalogue publications — a channel may not be another tenant’s (P0 #6c)', () => {
	let h: IHarness;

	beforeEach(async () => {
		mockCaller.tenantId = TENANT_A;
		mockCaller.organizationId = ORG_A;
		h = await harness();
	});

	afterEach(async () => {
		mockCaller.tenantId = null;
		mockCaller.organizationId = null;
		if (h?.dataSource?.isInitialized) await h.dataSource.destroy();
	});

	describe.each(PUBLICATIONS)('$table.channelId', ({ table, service, subject }) => {
		it('refuses to create a row on tenant B’s channel, and writes nothing', async () => {
			await expect(
				service(h).create({ ...subject, channelId: CHANNEL.b, status: PublicationStatus.ACTIVE })
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(await h.rows(table)).toEqual([]);
		});

		it('refuses to move an existing row onto tenant B’s channel, and leaves it as it was', async () => {
			const own = await service(h).create({ ...subject, channelId: CHANNEL.a, status: PublicationStatus.ACTIVE });

			await expect(service(h).update(own.id, { channelId: CHANNEL.b })).rejects.toBeInstanceOf(
				ForbiddenException
			);

			expect((await h.row(table, own.id)).channelId).toBe(CHANNEL.a);
		});

		it('still writes tenant A’s own channel and a channel of no tenant', async () => {
			const own = await service(h).create({ ...subject, channelId: CHANNEL.a, status: PublicationStatus.ACTIVE });
			expect((await h.row(table, own.id)).channelId).toBe(CHANNEL.a);

			await service(h).update(own.id, { channelId: CHANNEL.global });
			expect((await h.row(table, own.id)).channelId).toBe(CHANNEL.global);
		});
	});

	describe.each(SET_WRITES)('$name', ({ table, write }) => {
		it('refuses to publish the caller’s own subject on tenant B’s channel, and writes nothing', async () => {
			await expect(write(h, CHANNEL.b)).rejects.toBeInstanceOf(ForbiddenException);

			expect(await h.rows(table)).toEqual([]);
		});

		it('still publishes it on tenant A’s own channel', async () => {
			await write(h, CHANNEL.a);

			expect((await h.rows(table)).map((row) => [row.channelId, row.tenantId])).toEqual([[CHANNEL.a, TENANT_A]]);
		});
	});
});
