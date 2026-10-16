/**
 * The plain id columns of a shipment line, written against a real database holding two tenants (security audit
 * P0 #6c).
 *
 * A line names the order line it ships and the location its units came from. Neither column is a relation, so the
 * platform's cross-tenant check — which reads relation join columns — never saw them: `POST` / `PUT
 * /fulfillment-lines` and `updateFulfillmentLine` reach `FulfillmentLineService.create` / `update` directly, and a
 * shipment created over `POST /fulfillments` or `createFulfillment` writes its lines through the same `create`. A
 * caller of tenant A stored tenant B's order line or location on its own shipment.
 *
 * **Nothing the defect lives in is doubled here.** The services are the real ones over TypeORM repositories of an
 * in-memory better-sqlite3 database; the rows the ids name are real rows of tenant B, of tenant A and of no tenant.
 * `@gauzy/core` and `@gauzy/plugin-order` are doubled at the module boundary for the reasons the package's other suites
 * give, and the CRUD base is reduced to the tenant-scoped reads and writes the real one performs. Every refusal reads
 * the rows back, so a refusal that still wrote something fails too, and every column has a control.
 */
jest.mock('@gauzy/core', () => {
	const { NotFoundException } = require('@nestjs/common');
	const decimals = jest.requireActual('@gauzy/core/src/lib/money/decimal');
	const versionedWrite = jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write');

	/** A no-op decorator factory: the entities are declared, and mapped below by fixture schemas. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	/** The CRUD base, reduced to what the real one does for these calls: everything scoped to the caller's tenant. */
	class TenantAwareCrudService {
		constructor(
			protected readonly typeOrmRepository: any,
			protected readonly mikroOrmRepository?: any
		) {}

		get ormType(): string {
			return 'typeorm';
		}

		private scoped(where: Record<string, unknown> = {}): Record<string, unknown> {
			return { ...where, ...(mockCaller.tenantId ? { tenantId: mockCaller.tenantId } : {}) };
		}

		async findAll(options: any = {}): Promise<any> {
			const [items, total] = await this.typeOrmRepository.findAndCount({
				...options,
				where: this.scoped(options.where)
			});

			return { items, total };
		}

		async find(options: any = {}): Promise<any> {
			return this.typeOrmRepository.find({ ...options, where: this.scoped(options.where) });
		}

		async findOneByIdString(id: any, options: any = {}): Promise<any> {
			const record = id
				? await this.typeOrmRepository.findOne({
						...options,
						where: this.scoped({ ...(options.where ?? {}), id })
					})
				: null;

			if (!record) {
				throw new NotFoundException('The requested record was not found');
			}

			return record;
		}

		async create(entity: any): Promise<any> {
			return this.typeOrmRepository.save(
				this.typeOrmRepository.create({ ...entity, tenantId: mockCaller.tenantId })
			);
		}

		async update(id: any, partial: any): Promise<any> {
			if (typeof id === 'string') {
				await this.findOneByIdString(id);
			}

			return this.typeOrmRepository.update(this.scoped(typeof id === 'string' ? { id } : id), partial);
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
		subtractDecimalStrings: decimals.subtractDecimalStrings,
		addDecimalStrings: decimals.addDecimalStrings,
		compareDecimalStrings: decimals.compareDecimalStrings,
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		VersionedColumn: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		commitVersionedUpdate: versionedWrite.commitVersionedUpdate,
		versionExpectationOf: versionedWrite.versionExpectationOf,
		ApiException: jest.requireActual('@gauzy/core/src/lib/core/errors/api-exception').ApiException,
		ApiErrorCode: jest.requireActual('@gauzy/core/src/lib/core/errors/api-error-codes').ApiErrorCode,
		EventOutboxService: class {},
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		VERSION_EXPECTATION_PROPERTY: 'versionExpectation',
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

jest.mock('@gauzy/plugin-order', () => ({
	OrderLineService: class OrderLineService {},
	OrderLine: class OrderLine {},
	OrderTotalsService: class OrderTotalsService {},
	OrderStateMachine: class OrderStateMachine {}
}));

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null } = { tenantId: null };

import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { FulfillmentDirection } from '@gauzy/contracts';
import { FulfillmentLine } from './fulfillment-line/fulfillment-line.entity';
import { FulfillmentLineService } from './fulfillment-line/fulfillment-line.service';
import { Fulfillment } from './fulfillment/fulfillment.entity';
import { FulfillmentService } from './fulfillment/fulfillment.service';

type Row = Record<string, any>;

/** Tenant A — the caller — and tenant B, whose rows A must not point at. */
const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';

/** One order line and one location per owner: tenant A, tenant B and no tenant. */
const ORDER_LINE = { a: '00000000-0000-4000-8001-00000000000a', b: '00000000-0000-4000-8001-00000000000b' };
const WAREHOUSE = {
	a: '00000000-0000-4000-8002-00000000000a',
	b: '00000000-0000-4000-8002-00000000000b',
	global: '00000000-0000-4000-8002-00000000000c'
};

/** Tenant A's shipments the lines are written into. */
const SHIPMENT_ONE = '00000000-0000-4000-8003-0000000000a1';
const SHIPMENT_TWO = '00000000-0000-4000-8003-0000000000a2';

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
	new EntitySchema<any>({ name: 'OrderLineRow', tableName: 'order_line', columns: { ...(base() as any) } }),
	new EntitySchema<any>({ name: 'WarehouseRow', tableName: 'warehouse', columns: { ...(base() as any) } }),
	new EntitySchema<any>({
		name: 'Fulfillment',
		target: Fulfillment,
		tableName: 'fulfillment',
		columns: {
			...(base() as any),
			orderId: optional('varchar'),
			direction: optional('varchar'),
			status: optional('varchar'),
			version: { type: 'int', default: 1 }
		}
	}),
	new EntitySchema<any>({
		name: 'FulfillmentLine',
		target: FulfillmentLine,
		tableName: 'fulfillment_line',
		columns: {
			...(base() as any),
			fulfillmentId: { type: 'varchar' },
			orderLineId: { type: 'varchar' },
			quantity: { type: 'decimal' },
			warehouseId: optional('varchar'),
			metadata: optional('simple-json')
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
	lines: FulfillmentLineService;
	fulfillments: FulfillmentService;
	rows: (table: string) => Promise<Row[]>;
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

	await dataSource.query(`INSERT INTO "order_line" ("id", "tenantId") VALUES (?, ?), (?, ?)`, [
		ORDER_LINE.a,
		TENANT_A,
		ORDER_LINE.b,
		TENANT_B
	]);
	await dataSource.query(`INSERT INTO "warehouse" ("id", "tenantId") VALUES (?, ?), (?, ?), (?, ?)`, [
		WAREHOUSE.a,
		TENANT_A,
		WAREHOUSE.b,
		TENANT_B,
		WAREHOUSE.global,
		null
	]);

	const repository = (entity: unknown) => dataSource.getRepository(entity as any) as any;
	const lines = new FulfillmentLineService(repository(FulfillmentLine), undefined as any);
	const fulfillments = new FulfillmentService(
		repository(Fulfillment),
		undefined as any,
		lines,
		undefined as any,
		undefined as any,
		undefined as any
	);

	return {
		dataSource,
		lines,
		fulfillments,
		rows: (table) => dataSource.query(`SELECT * FROM "${table}"`),
		row: async (table, id) => (await dataSource.query(`SELECT * FROM "${table}" WHERE "id" = ?`, [id]))[0]
	};
}

describe('fulfilment lines — a plain id column may not name another tenant’s row (P0 #6c)', () => {
	let h: IHarness;

	beforeEach(async () => {
		mockCaller.tenantId = TENANT_A;
		h = await harness();
	});

	afterEach(async () => {
		mockCaller.tenantId = null;
		if (h?.dataSource?.isInitialized) await h.dataSource.destroy();
	});

	describe('orderLineId', () => {
		it('refuses to create a line shipping tenant B’s order line, and writes nothing', async () => {
			await expect(
				h.lines.create({ fulfillmentId: SHIPMENT_ONE, orderLineId: ORDER_LINE.b, quantity: 1 } as any)
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(await h.rows('fulfillment_line')).toEqual([]);
		});

		it('refuses a correction that restates tenant B’s order line on a line that holds it', async () => {
			// A row written before the fix: the correction may restate what the row holds, but not B's id.
			const smuggled = await h.dataSource.getRepository(FulfillmentLine).save({
				fulfillmentId: SHIPMENT_ONE,
				orderLineId: ORDER_LINE.b,
				quantity: 1,
				tenantId: TENANT_A
			} as any);

			await expect(h.lines.update(smuggled.id, { orderLineId: ORDER_LINE.b } as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);
		});

		it('still creates a line shipping tenant A’s own order line', async () => {
			const line = await h.lines.create({
				fulfillmentId: SHIPMENT_ONE,
				orderLineId: ORDER_LINE.a,
				quantity: 1
			} as any);

			expect((await h.row('fulfillment_line', line.id)).orderLineId).toBe(ORDER_LINE.a);
		});
	});

	describe('warehouseId', () => {
		it('refuses to create a line taken from tenant B’s location, and writes nothing', async () => {
			await expect(
				h.lines.create({
					fulfillmentId: SHIPMENT_ONE,
					orderLineId: ORDER_LINE.a,
					quantity: 1,
					warehouseId: WAREHOUSE.b
				} as any)
			).rejects.toBeInstanceOf(ForbiddenException);

			expect(await h.rows('fulfillment_line')).toEqual([]);
		});

		it('refuses to move an existing line to tenant B’s location, and leaves it as it was', async () => {
			const line = await h.lines.create({
				fulfillmentId: SHIPMENT_ONE,
				orderLineId: ORDER_LINE.a,
				quantity: 1,
				warehouseId: WAREHOUSE.a
			} as any);

			await expect(h.lines.update(line.id, { warehouseId: WAREHOUSE.b } as any)).rejects.toBeInstanceOf(
				ForbiddenException
			);

			expect((await h.row('fulfillment_line', line.id)).warehouseId).toBe(WAREHOUSE.a);
		});

		it('still writes tenant A’s own location, a location of no tenant, an id that names no row, and none', async () => {
			const line = await h.lines.create({
				fulfillmentId: SHIPMENT_TWO,
				orderLineId: ORDER_LINE.a,
				quantity: 1,
				warehouseId: WAREHOUSE.a
			} as any);

			for (const value of [WAREHOUSE.global, '00000000-0000-4000-8002-0000000000ff', null]) {
				await h.lines.update(line.id, { warehouseId: value } as any);
				expect((await h.row('fulfillment_line', line.id)).warehouseId).toBe(value);
			}
		});
	});

	it('refuses a shipment whose line names tenant B’s rows before the shipment itself is written', async () => {
		// A return leg reads no order line for its quantity, so nothing but this check stood between the payload and
		// the write — and the shipment row is written before its lines, in separate statements.
		await expect(
			h.fulfillments.create({
				direction: FulfillmentDirection.RETURN,
				lines: [{ orderLineId: ORDER_LINE.b, quantity: 1, warehouseId: WAREHOUSE.a }]
			} as any)
		).rejects.toBeInstanceOf(ForbiddenException);

		expect(await h.rows('fulfillment')).toEqual([]);
		expect(await h.rows('fulfillment_line')).toEqual([]);
	});
});
