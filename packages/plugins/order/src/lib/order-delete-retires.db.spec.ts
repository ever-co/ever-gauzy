/**
 * `DELETE /:id` of every order record retires the row and never erases it, run for real on both ORMs.
 *
 * `13` §11.4 keeps every order table in one retention row — "`order*`, `payment` (the columns this programme
 * adds), `payment_capture`, `refund`, `tax_line`, `adjustment`, `subscription_billing`, `order_return*` |
 * Indefinite | Soft delete only (`deletedAt`); no hard delete through the API" — and the owner decided it
 * again on 2026-10-13 (decision 10, "Soft delete only"; decision 4, "Fix all on feat now"). Ten controllers
 * of this domain declared `DELETE ':id'` as an override that reached `CrudController`'s hard `delete`, so an
 * order — "the immutable commercial record", whose hard delete cascades into its lines, addresses, delivery
 * choices, totals history, changes, credit lines, timeline and payment collection — its ledger ("never
 * updated and never deleted"), its timeline and its change audit could all be erased by one request, and no
 * `PUT ':id/recover'` could bring any of them back. The five GraphQL fields that mirror five of those routes
 * reached the same hard delete.
 *
 * **Nothing the defect lives in is doubled here.** The controllers, the resolvers and the services are the
 * real ones; the CRUD bases below the services are the kernel's own `CrudService` and
 * `TenantAwareCrudService`, taken from their modules rather than restated, and the request context is the
 * kernel's own class with the caller stated through it; the repositories are real — a TypeORM repository
 * over an in-memory better-sqlite3 database, and the kernel's `MikroOrmBaseEntityRepository` over an
 * in-memory better-sqlite database with the production soft-delete extension (`mikro-orm-soft-delete`'s
 * `SoftDeletable` and `SoftDeleteHandler`, the mechanism `SoftDeletableBaseEntity` uses), so a retired row
 * is filtered out by default and a removal is an `UPDATE … SET deletedAt`, exactly as in production. Each
 * ORM branch is selected the way the application selects it — through `CrudService.ormType`.
 *
 * The only double is `CrudController`, restated in the shape `packages/core/src/lib/core/crud/crud.controller.ts`
 * declares it — `delete` hands the service the identifier, `softRemove` and `softRecover` hand it the
 * identifier and the rest parameter as an array — because the real class reaches the entity graph through
 * its DTO imports.
 *
 * The row is a standalone fixture rather than an order entity, for the reason the kernel's ORM conformance
 * suite gives: the production base entity carries a Postgres-only identifier default that SQLite rejects.
 * The retirement reads nothing of a row but its identifier, its tenant and its deletion date, so a fixture
 * with exactly those columns — and, on TypeORM, the `tenant` relation the tenant-aware base names in its
 * criteria — is the whole of what the ten services act on here; one fixture table is shared by all of them.
 */
jest.mock('@gauzy/plugin-cart', () => ({
	TotalsCalculator: jest.requireActual('@gauzy/plugin-cart/src/lib/totals/totals-calculator').TotalsCalculator
}));

jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the order entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The kernel's own CRUD bases and request context: the retirement under test is their code.
		CrudService: jest.requireActual('@gauzy/core/src/lib/core/crud/crud.service').CrudService,
		TenantAwareCrudService: jest.requireActual('@gauzy/core/src/lib/core/crud/tenant-aware-crud.service')
			.TenantAwareCrudService,
		MikroOrmBaseEntityRepository: jest.requireActual(
			'@gauzy/core/src/lib/core/repository/mikro-orm-base-entity.repository'
		).MikroOrmBaseEntityRepository,
		RequestContext: jest.requireActual('@gauzy/core/src/lib/core/context').RequestContext,
		// The base controller, in the shape the kernel declares it.
		CrudController: class CrudController {
			constructor(protected readonly crudService: any) {}

			async delete(id: any, ..._options: any[]): Promise<any> {
				return this.crudService.delete(id);
			}

			async softRemove(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRemove(id, options);
			}

			async softRecover(id: any, ...options: any[]): Promise<any> {
				return await this.crudService.softRecover(id, options);
			}
		},
		quoteIdentifier: (identifier: string) => `"${identifier}"`,
		prepareSQLQuery: (query: string) => query,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		BaseQueryDTO: class {},
		UUIDValidationPipe: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		Permissions: jest.requireActual('@gauzy/core/src/lib/shared/decorators/permissions.decorator').Permissions,
		UseValidationPipe: decorator,
		PermissionGuard: class {},
		TenantPermissionGuard: class {},
		FeatureFlagGuard: class {},
		Idempotent: jest.requireActual('@gauzy/core/src/lib/idempotency/idempotent.decorator').Idempotent,
		Versioned: () => decorator(),
		VersionedColumn: decorator,
		commitVersionedUpdate: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.commitVersionedUpdate,
		versionExpectationOf: jest.requireActual('@gauzy/core/src/lib/concurrency/versioned-write')
			.versionExpectationOf,
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		paginateRows: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection').paginateRows,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		AdjustmentService: class {},
		TaxLineService: class {},
		SequenceService: class {}
	};
});

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import {
	Column,
	DataSource,
	DeleteDateColumn,
	Entity as TypeOrmEntity,
	JoinColumn,
	ManyToOne,
	PrimaryColumn,
	Repository
} from 'typeorm';
import { Entity as MikroEntity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { CrudService, MikroOrmBaseEntityRepository, RequestContext, TenantAwareCrudService } from '@gauzy/core';
import { OrderController } from './order/order.controller';
import { OrderService } from './order/order.service';
import { OrderAddressController } from './order-address/order-address.controller';
import { OrderAddressService } from './order-address/order-address.service';
import { OrderChangeController } from './order-change/order-change.controller';
import { OrderChangeService } from './order-change/order-change.service';
import { OrderChangeActionController } from './order-change-action/order-change-action.controller';
import { OrderChangeActionService } from './order-change-action/order-change-action.service';
import { OrderCreditLineController } from './order-credit-line/order-credit-line.controller';
import { OrderCreditLineService } from './order-credit-line/order-credit-line.service';
import { OrderHistoryController } from './order-history/order-history.controller';
import { OrderHistoryService } from './order-history/order-history.service';
import { OrderLineController } from './order-line/order-line.controller';
import { OrderLineService } from './order-line/order-line.service';
import { OrderShippingMethodController } from './order-shipping-method/order-shipping-method.controller';
import { OrderShippingMethodService } from './order-shipping-method/order-shipping-method.service';
import { OrderSummaryController } from './order-summary/order-summary.controller';
import { OrderSummaryService } from './order-summary/order-summary.service';
import { OrderTransactionController } from './order-transaction/order-transaction.controller';
import { OrderTransactionService } from './order-transaction/order-transaction.service';
import { OrderResolver } from './graphql/order.resolver';
import { OrderChangeResolver } from './graphql/order-change.resolver';

/** The caller's tenant and organization, and another tenant's. */
const TENANT_A = '00000000-0000-4000-8000-00000000000a';
const ORGANIZATION_A = '00000000-0000-4000-8000-0000000000a1';
const TENANT_B = '00000000-0000-4000-8000-00000000000b';
const ORGANIZATION_B = '00000000-0000-4000-8000-0000000000b1';

/** The rows: the caller's own, and one of another tenant. */
const OWN = '00000000-0000-4000-8000-000000000001';
const FOREIGN_TENANT = '00000000-0000-4000-8000-000000000002';

/** The tenant a row belongs to, as TypeORM maps it: the relation the tenant-aware base names in its criteria. */
@TypeOrmEntity('order_delete_fixture_tenant')
class TenantFixture {
	@PrimaryColumn({ type: 'varchar' })
	id!: string;
}

/**
 * The one table every service acts on here: an identifier, the two scope columns and a deletion date,
 * mapped for both ORMs, with the production MikroORM soft-delete mechanism on it.
 */
@SoftDeletable(() => OrderRecordFixture, 'deletedAt', () => new Date())
@TypeOrmEntity('order_delete_fixture')
@MikroEntity({ tableName: 'order_delete_fixture' })
class OrderRecordFixture {
	@PrimaryColumn({ type: 'varchar' })
	@PrimaryKey({ type: 'string' })
	id!: string;

	@ManyToOne(() => TenantFixture, { nullable: true, createForeignKeyConstraints: false })
	@JoinColumn({ name: 'tenantId' })
	tenant?: TenantFixture;

	@Column({ type: 'varchar' })
	@Property({ type: 'string' })
	tenantId!: string;

	@Column({ type: 'varchar' })
	@Property({ type: 'string' })
	organizationId!: string;

	@DeleteDateColumn({ nullable: true })
	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

/** The two rows every case starts from. */
const SEED: OrderRecordFixture[] = [
	{ id: OWN, tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: null },
	{ id: FOREIGN_TENANT, tenantId: TENANT_B, organizationId: ORGANIZATION_B, deletedAt: null }
];

type Row = Record<string, any>;

/** An empty collaborator: the retirement touches none, and one that did would fail here loudly. */
const none = {} as never;

/**
 * The ten routes, each a real controller over its real service, built over the two fixture repositories.
 */
const ROUTES: ReadonlyArray<{ route: string; build: (typeOrm: unknown, mikroOrm: unknown) => Row }> = [
	{
		route: 'orders',
		build: (t, m) =>
			new OrderController(
				new OrderService(t as never, m as never, none, none, none, none, none, none, none),
				none,
				none,
				none,
				none,
				none,
				none,
				none
			)
	},
	{
		route: 'order-lines',
		build: (t, m) => new OrderLineController(new OrderLineService(t as never, m as never, none))
	},
	{
		route: 'order-transactions',
		build: (t, m) => new OrderTransactionController(new OrderTransactionService(t as never, m as never))
	},
	{
		route: 'order-history',
		build: (t, m) => new OrderHistoryController(new OrderHistoryService(t as never, m as never))
	},
	{
		route: 'order-summaries',
		build: (t, m) => new OrderSummaryController(new OrderSummaryService(t as never, m as never))
	},
	{
		route: 'order-credit-lines',
		build: (t, m) => new OrderCreditLineController(new OrderCreditLineService(t as never, m as never))
	},
	{
		route: 'order-changes',
		build: (t, m) =>
			new OrderChangeController(
				new OrderChangeService(
					t as never,
					m as never,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none
				)
			)
	},
	{
		route: 'order-change-actions',
		build: (t, m) => new OrderChangeActionController(new OrderChangeActionService(t as never, m as never))
	},
	{
		route: 'order-addresses',
		build: (t, m) => new OrderAddressController(new OrderAddressService(t as never, m as never))
	},
	{
		route: 'order-shipping-methods',
		build: (t, m) => new OrderShippingMethodController(new OrderShippingMethodService(t as never, m as never))
	}
];

/**
 * The five GraphQL fields that mirror five of those routes, each on its real resolver with the real service
 * of its resource in the constructor slot that resource's fields read, and an empty collaborator elsewhere.
 */
const FIELDS: ReadonlyArray<{ field: string; build: (typeOrm: unknown, mikroOrm: unknown) => Row }> = [
	{
		field: 'deleteOrder',
		build: (t, m) =>
			new OrderResolver(
				new OrderService(t as never, m as never, none, none, none, none, none, none, none),
				none,
				none,
				none,
				none,
				none,
				none,
				none
			)
	},
	{
		field: 'deleteOrderAddress',
		build: (t, m) =>
			new OrderResolver(none, none, none, new OrderAddressService(t as never, m as never), none, none, none, none)
	},
	{
		field: 'deleteOrderCreditLine',
		build: (t, m) =>
			new OrderResolver(
				none,
				none,
				none,
				none,
				none,
				new OrderCreditLineService(t as never, m as never),
				none,
				none
			)
	},
	{
		field: 'deleteOrderChange',
		build: (t, m) =>
			new OrderChangeResolver(
				new OrderChangeService(
					t as never,
					m as never,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none,
					none
				),
				none,
				none,
				none,
				none
			)
	},
	{
		field: 'deleteOrderChangeAction',
		build: (t, m) =>
			new OrderChangeResolver(none, new OrderChangeActionService(t as never, m as never), none, none, none)
	}
];

/** The two ORM branches of the kernel's CRUD base, named as `CrudService.ormType` names them. */
const ORMS = ['typeorm', 'mikro-orm'] as const;

type Orm = (typeof ORMS)[number];

describe('DELETE /:id of an order record retires it and never erases it (13 §11.4), on a real database', () => {
	let dataSource: DataSource;
	let typeOrmRows: Repository<OrderRecordFixture>;
	let orm: MikroORM<BetterSqliteDriver>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TenantFixture, OrderRecordFixture],
			synchronize: true,
			logging: false,
			// The platform's shipped setting (`TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR`): `null` is `IS NULL`.
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		typeOrmRows = dataSource.getRepository(OrderRecordFixture);
		await dataSource.getRepository(TenantFixture).save([{ id: TENANT_A }, { id: TENANT_B }]);

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [OrderRecordFixture],
			extensions: [SoftDeleteHandler],
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.schema.createSchema();
	});

	afterAll(async () => {
		await dataSource?.destroy();
		await orm?.close(true);
	});

	afterEach(() => jest.restoreAllMocks());

	/**
	 * Seeds both databases, selects one ORM branch and signs the caller in to tenant A, organization A1.
	 *
	 * @param ormType The branch of the kernel's CRUD base to run.
	 * @returns The two repositories the services are built over, and a reader of one row as stored.
	 */
	async function arrange(ormType: Orm): Promise<{
		typeOrm: Repository<OrderRecordFixture>;
		mikroOrm: unknown;
		stored: (id: string) => Promise<OrderRecordFixture | null>;
	}> {
		await typeOrmRows.clear();
		await typeOrmRows.save(SEED.map((row) => ({ ...row })));

		await orm.em.getConnection().execute('DELETE FROM order_delete_fixture');
		const em = orm.em.fork();
		for (const row of SEED) {
			em.persist(em.create(OrderRecordFixture, { ...row }));
		}
		await em.flush();

		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType as never);
		// The caller, stated through the kernel's own request context, which the tenant-aware base reads.
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: 'user-a',
			tenantId: TENANT_A
		} as never);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION_A);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false);

		const mikroOrm = new MikroOrmBaseEntityRepository<OrderRecordFixture>(orm.em.fork(), OrderRecordFixture);

		return {
			typeOrm: typeOrmRows,
			mikroOrm,
			// Read with retired rows included and outside any scope, so the assertion sees what is stored.
			stored: async (id: string) =>
				ormType === 'typeorm'
					? typeOrmRows.findOne({ where: { id }, withDeleted: true })
					: orm.em.fork().findOne(OrderRecordFixture, { id }, { filters: false })
		};
	}

	describe.each(ORMS)('on the %s branch', (ormType) => {
		describe.each(ROUTES)('DELETE /$route/:id', ({ build }) => {
			it('keeps the row stored, with deletedAt set, and answers the retired row', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const controller = build(typeOrm, mikroOrm);

				const answer = await controller.delete(OWN);

				// The row is still there — read with retired rows included — and it is retired.
				const row = await stored(OWN);
				expect(row).not.toBeNull();
				expect(row?.deletedAt).toBeTruthy();
				// The route answers the row it retired, as `DELETE ':id/soft'` does.
				expect(answer).toMatchObject({ id: OWN });
			});

			it('can be undone: PUT /:id/recover brings the row back', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const controller = build(typeOrm, mikroOrm);

				await controller.delete(OWN);
				await expect(controller.softRecover(OWN)).resolves.toMatchObject({ id: OWN });

				expect((await stored(OWN))?.deletedAt ?? null).toBeNull();
			});

			it('never reaches a row of another tenant, and leaves it live', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const controller = build(typeOrm, mikroOrm);

				await expect(controller.delete(FOREIGN_TENANT)).rejects.toThrow(NotFoundException);

				expect(await stored(FOREIGN_TENANT)).toMatchObject({ id: FOREIGN_TENANT, deletedAt: null });
			});
		});

		describe.each(FIELDS)('$field', ({ field, build }) => {
			it('keeps the row stored, with deletedAt set, and answers { id, deleted: true }', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const resolver = build(typeOrm, mikroOrm);

				const answer = await resolver[field](OWN);

				const row = await stored(OWN);
				expect(row).not.toBeNull();
				expect(row?.deletedAt).toBeTruthy();
				expect(answer).toEqual({ id: OWN, deleted: true });
			});

			it('answers deleted: false for a row of another tenant, and leaves it live', async () => {
				const { typeOrm, mikroOrm, stored } = await arrange(ormType);
				const resolver = build(typeOrm, mikroOrm);

				await expect(resolver[field](FOREIGN_TENANT)).resolves.toEqual({ id: FOREIGN_TENANT, deleted: false });

				expect(await stored(FOREIGN_TENANT)).toMatchObject({ id: FOREIGN_TENANT, deletedAt: null });
			});
		});

		it('CONTROL: the kernel’s hard delete, which the routes reached before, erases the row', async () => {
			const { typeOrm, mikroOrm, stored } = await arrange(ormType);
			const service = new OrderTransactionService(typeOrm as never, mikroOrm as never);

			// What `DELETE /order-transactions/:id` reached before: the harness can see an erasure.
			await expect(TenantAwareCrudService.prototype.delete.call(service, OWN)).resolves.toMatchObject({
				affected: 1
			});

			expect(await stored(OWN)).toBeNull();
		});
	});
});
