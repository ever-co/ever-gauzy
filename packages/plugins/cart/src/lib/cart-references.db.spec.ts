/**
 * The plain id columns of a cart's child rows, written against a real database holding two tenants (security audit
 * P0 #6c).
 *
 * A line names its product, variant, seller, tax class, location and subscription plan; an applied promotion its
 * promotion and coupon; a delivery choice its shipping option and tax class. None of those columns is a relation, so
 * the platform's cross-tenant check — which reads relation join columns — never saw them, and every write of the three
 * rows stored tenant B's ids for a caller of tenant A. The generic `/cart-lines`, `/cart-promotions` and
 * `/cart-shipping-methods` routes reach `create` / `update` of these services directly; the cart's own line, delivery,
 * promotion and merge verbs, on REST and GraphQL alike, reach them through `CommerceCartService`.
 *
 * **Nothing the defect lives in is doubled here.** The services are the real ones over TypeORM repositories of an
 * in-memory better-sqlite3 database; the rows the ids name are real rows of tenant B, of tenant A and of no tenant.
 * `@gauzy/core` is doubled at the module boundary for the reason the package's other suites give (its barrel boots the
 * whole application), and its CRUD base is reduced to the tenant-scoped write the real one performs. Every refusal
 * reads the rows back, so a refusal that still wrote something fails too, and every column has a control: the same
 * write naming tenant A's row still works.
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
				this.typeOrmRepository.create({ ...entity, tenantId: mockCaller.tenantId })
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
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		VersionedColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null } = { tenantId: null };

import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { CommerceCartLine } from './commerce-cart-line/commerce-cart-line.entity';
import { CommerceCartLineService } from './commerce-cart-line/commerce-cart-line.service';
import { CommerceCartPromotion } from './commerce-cart-promotion/commerce-cart-promotion.entity';
import { CommerceCartPromotionService } from './commerce-cart-promotion/commerce-cart-promotion.service';
import { CommerceCartShippingMethod } from './commerce-cart-shipping-method/commerce-cart-shipping-method.entity';
import { CommerceCartShippingMethodService } from './commerce-cart-shipping-method/commerce-cart-shipping-method.service';

type Row = Record<string, any>;

/** Tenant A — the caller — and tenant B, whose rows A must not point at. */
const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const CART = '00000000-0000-4000-8000-0000000000c1';

/** The tables the plain id columns name, each holding one row of A, one of B and one of no tenant. */
const TARGETS = [
	'product',
	'product_variant',
	'seller',
	'tax_category',
	'warehouse',
	'subscription_plan',
	'promotion',
	'coupon',
	'shipping_option'
] as const;

type Target = (typeof TARGETS)[number];

/** The last digit of a row's id: tenant A's, tenant B's, or no tenant's. */
const OWNER = { a: 'a', b: 'b', global: 'c' } as const;

/** A deterministic id per table and owner, so a failure names the row it was about. */
const idOf = (table: Target, owner: keyof typeof OWNER) =>
	`00000000-0000-4000-${String(TARGETS.indexOf(table) + 1).padStart(4, '0')}-00000000000${OWNER[owner]}`;

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

const optional = (type: string) => ({ type, nullable: true });

const schemas = [
	...TARGETS.map(
		(table) =>
			new EntitySchema<any>({
				name: `Target_${table}`,
				tableName: table,
				columns: { ...(base() as any), name: optional('varchar') }
			})
	),
	new EntitySchema<any>({
		name: 'CommerceCartLine',
		target: CommerceCartLine,
		tableName: 'commerce_cart_line',
		columns: {
			...(base() as any),
			cartId: { type: 'varchar' },
			productId: optional('varchar'),
			variantId: optional('varchar'),
			sellerId: optional('varchar'),
			taxCategoryId: optional('varchar'),
			warehouseId: optional('varchar'),
			subscriptionPlanId: optional('varchar'),
			title: optional('varchar'),
			quantity: { type: 'decimal', default: 1 },
			unitPrice: { type: 'decimal', default: 0 }
		}
	}),
	new EntitySchema<any>({
		name: 'CommerceCartPromotion',
		target: CommerceCartPromotion,
		tableName: 'commerce_cart_promotion',
		columns: {
			...(base() as any),
			cartId: { type: 'varchar' },
			promotionId: optional('varchar'),
			couponId: optional('varchar'),
			code: optional('varchar'),
			amount: { type: 'decimal', default: 0 }
		}
	}),
	new EntitySchema<any>({
		name: 'CommerceCartShippingMethod',
		target: CommerceCartShippingMethod,
		tableName: 'commerce_cart_shipping_method',
		columns: {
			...(base() as any),
			cartId: { type: 'varchar' },
			shippingOptionId: optional('varchar'),
			taxCategoryId: optional('varchar'),
			name: optional('varchar'),
			amount: { type: 'decimal', default: 0 }
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
	lines: CommerceCartLineService;
	promotions: CommerceCartPromotionService;
	shippingMethods: CommerceCartShippingMethodService;
	/** Every row of a table, retired or not. */
	rows: (table: string) => Promise<Row[]>;
	/** One row, retired or not. */
	row: (table: string, id: string) => Promise<Row | undefined>;
}

async function harness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: schemas,
		synchronize: true,
		logging: false
	});
	await dataSource.initialize();

	for (const table of TARGETS) {
		await dataSource.query(
			`INSERT INTO "${table}" ("id", "tenantId", "name") VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)`,
			[
				idOf(table, 'a'),
				TENANT_A,
				`${table} of A`,
				idOf(table, 'b'),
				TENANT_B,
				`${table} of B`,
				idOf(table, 'global'),
				null,
				`${table} of no tenant`
			]
		);
	}

	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;

	return {
		dataSource,
		lines: new CommerceCartLineService(repository(CommerceCartLine), undefined as any),
		promotions: new CommerceCartPromotionService(repository(CommerceCartPromotion), undefined as any),
		shippingMethods: new CommerceCartShippingMethodService(
			repository(CommerceCartShippingMethod),
			undefined as any
		),
		rows: (table) => dataSource.query(`SELECT * FROM "${table}"`),
		row: async (table, id) => (await dataSource.query(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0]
	};
}

/** The three child rows, the service that writes each, and the plain id columns it holds. */
const ROWS: Array<{
	table: string;
	service: (h: IHarness) => {
		create: (entity: any) => Promise<any>;
		update: (id: any, partial: any) => Promise<any>;
	};
	seed: Row;
	columns: Array<[string, Target]>;
}> = [
	{
		table: 'commerce_cart_line',
		service: (h) => h.lines,
		seed: { cartId: CART, title: 'A line', quantity: 1, unitPrice: 10 },
		columns: [
			['productId', 'product'],
			['variantId', 'product_variant'],
			['sellerId', 'seller'],
			['taxCategoryId', 'tax_category'],
			['warehouseId', 'warehouse'],
			['subscriptionPlanId', 'subscription_plan']
		]
	},
	{
		table: 'commerce_cart_promotion',
		service: (h) => h.promotions,
		seed: { cartId: CART, code: 'SAVE10', amount: 1 },
		columns: [
			['promotionId', 'promotion'],
			['couponId', 'coupon']
		]
	},
	{
		table: 'commerce_cart_shipping_method',
		service: (h) => h.shippingMethods,
		seed: { cartId: CART, name: 'Courier', amount: 5 },
		columns: [
			['shippingOptionId', 'shipping_option'],
			['taxCategoryId', 'tax_category']
		]
	}
];

const CASES = ROWS.flatMap((row) => row.columns.map(([column, target]) => ({ ...row, column, target })));

describe('cart child rows — a plain id column may not name another tenant’s row (P0 #6c)', () => {
	let h: IHarness;

	beforeEach(async () => {
		mockCaller.tenantId = TENANT_A;
		h = await harness();
	});

	afterEach(async () => {
		mockCaller.tenantId = null;
		if (h?.dataSource?.isInitialized) await h.dataSource.destroy();
	});

	describe.each(CASES)('$table.$column', ({ table, service, seed, column, target }) => {
		it('refuses to create a row naming tenant B’s row, and writes nothing', async () => {
			await expect(service(h).create({ ...seed, [column]: idOf(target, 'b') })).rejects.toBeInstanceOf(
				ForbiddenException
			);

			expect(await h.rows(table)).toEqual([]);
		});

		it('refuses to point an existing row at tenant B’s row, and leaves it as it was', async () => {
			const own = await service(h).create({ ...seed, [column]: idOf(target, 'a') });

			await expect(service(h).update(own.id, { [column]: idOf(target, 'b') })).rejects.toBeInstanceOf(
				ForbiddenException
			);

			expect((await h.row(table, own.id))[column]).toBe(idOf(target, 'a'));
		});

		it('still writes tenant A’s own row, a row of no tenant, an id that names no row, and no id at all', async () => {
			const own = await service(h).create({ ...seed, [column]: idOf(target, 'a') });
			expect((await h.row(table, own.id))[column]).toBe(idOf(target, 'a'));

			for (const value of [idOf(target, 'global'), '00000000-0000-4000-8000-0000000000ff', null]) {
				await service(h).update(own.id, { [column]: value });
				expect((await h.row(table, own.id))[column]).toBe(value);
			}

			const bare = await service(h).create({ ...seed });
			expect((await h.row(table, bare.id))[column]).toBeNull();
		});
	});

	it('refuses a reference that is not an id at all, as the unvalidated GraphQL input can carry one', async () => {
		await expect(
			h.lines.create({ cartId: CART, title: 'A line', quantity: 1, unitPrice: 10, productId: { id: 'x' } } as any)
		).rejects.toBeInstanceOf(BadRequestException);

		expect(await h.rows('commerce_cart_line')).toEqual([]);
	});

	it('holds a caller with no tenant — a job, a seeder — to nothing, as the platform’s check does', async () => {
		mockCaller.tenantId = null;

		const line = await h.lines.create({
			cartId: CART,
			title: 'A line',
			quantity: 1,
			unitPrice: 10,
			productId: idOf('product', 'b')
		} as any);

		expect((await h.row('commerce_cart_line', line.id)).productId).toBe(idOf('product', 'b'));
	});
});
