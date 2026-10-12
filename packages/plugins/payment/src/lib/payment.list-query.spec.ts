/**
 * The eight payment list routes, read from the query string a client actually sends.
 *
 * The routes bind their query to `BaseQueryDTO` and mount no validation pipe, so a handler receives the
 * parser's raw object — every value a string — and none of the DTO's transforms run. The routes handed
 * that object to their service whole, and three things went wrong at once:
 *
 * - `?withDeleted=false` reached the kernel as the string `'false'`, which is truthy, and both ORMs lift
 *   the soft-delete filter for a truthy value, so the route answered with the retired rows as well;
 * - a flat filter (`?refundId=R1`, `?status=…`) became a top-level find option that neither ORM reads,
 *   so the route answered every row of the organization and said nothing about the dropped filter;
 * - `skip` travelled as a string whose meaning was left to the ORM branch.
 *
 * `toPaymentListOptions` is the one place the routes now read their query, and this suite pins it three
 * ways: the function on its own; every one of the eight routes, over a stub of its service, handing the
 * service the split options; and four of the routes end to end — the real controller, the real service,
 * the kernel's own `CrudService.findAll` and a real database — on **both** ORM branches, so the failure
 * scenario of each finding is replayed against the store rather than against a double.
 *
 * The database end of the suite follows `payment-scoped-crud.service.spec.ts`: a standalone fixture table
 * mapped for TypeORM (in-memory better-sqlite3) and for MikroORM (in-memory better-sqlite, with the
 * production `mikro-orm-soft-delete` extension), because the production base entity's identifier default
 * is Postgres-only. The GraphQL connection of the session service is driven over the same rows, so the
 * REST route's `skip` and the connection's `offset` are compared as the same question.
 */
jest.mock('@gauzy/core', () => {
	const { SetMetadata } = require('@nestjs/common');
	const { PERMISSIONS_METADATA } = require('@gauzy/constants');

	/** A no-op decorator factory: nothing here is mapped, validated or guarded. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		// The kernel's own CRUD base and MikroORM repository base: the reads under test are theirs.
		CrudService: jest.requireActual('@gauzy/core/src/lib/core/crud/crud.service').CrudService,
		MikroOrmBaseEntityRepository: jest.requireActual(
			'@gauzy/core/src/lib/core/repository/mikro-orm-base-entity.repository'
		).MikroOrmBaseEntityRepository,
		// The connection helpers the GraphQL list answers with are the kernel's own as well.
		connectionFromOffsetPage: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.connectionFromOffsetPage,
		resolveConnectionWindow: jest.requireActual('@gauzy/core/src/lib/api/graphql-connection')
			.resolveConnectionWindow,
		RequestContext: {
			currentTenantId: () => mockCaller.tenantId,
			currentOrganizationId: () => mockCaller.organizationId,
			currentUser: () => null,
			currentUserId: () => null,
			hasPermission: () => false
		},
		// The routes' base class is only a holder for the service here: the list routes are overridden.
		CrudController: class CrudController {
			constructor(protected readonly crudService: unknown) {}
		},
		BaseQueryDTO: class BaseQueryDTO {},
		TenantOrganizationBaseDTO: class TenantOrganizationBaseDTO {},
		AbstractValidationPipe: class AbstractValidationPipe {
			constructor(..._args: any[]) {
				/* no validation happens in this suite */
			}
			transform(value: any): any {
				return value;
			}
		},
		UseValidationPipe: decorator,
		UUIDValidationPipe: class UUIDValidationPipe {},
		Permissions: (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA, permissions),
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		FeatureFlagGuard: class FeatureFlagGuard {},
		Idempotent: decorator,
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		ColumnIndex: decorator,
		ExportRedacted: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMOneToMany: decorator,
		MultiORMManyToOne: decorator,
		JsonColumn: decorator,
		JsonArrayColumn: decorator,
		ColumnNumericTransformerPipe: class {
			to(value: unknown) {
				return value;
			}
			from(value: unknown) {
				return value;
			}
		},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		BaseEvent: class {},
		EventBus: class {},
		Payment: class Payment {},
		Integration: class Integration {},
		readAffectedRows: () => 0
	};
});

import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Column, DataSource, DeleteDateColumn, Entity as TypeOrmEntity, PrimaryColumn, Repository } from 'typeorm';
import { Entity as MikroEntity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { CrudService, MikroOrmBaseEntityRepository } from '@gauzy/core';
import { toPaymentListOptions } from './payment.list-query';
import { PaymentCaptureController } from './payment-capture/payment-capture.controller';
import { PaymentCaptureService } from './payment-capture/payment-capture.service';
import { PaymentCollectionController } from './payment-collection/payment-collection.controller';
import { PaymentProviderController } from './payment-provider/payment-provider.controller';
import { PaymentProviderService } from './payment-provider/payment-provider.service';
import { PaymentSessionController } from './payment-session/payment-session.controller';
import { PaymentSessionService } from './payment-session/payment-session.service';
import { PaymentWebhookEventController } from './payment-webhook-event/payment-webhook-event.controller';
import { RefundLineController } from './refund-line/refund-line.controller';
import { RefundLineService } from './refund-line/refund-line.service';
import { RefundReasonController } from './refund-reason/refund-reason.controller';
import { RefundController } from './refund/refund.controller';
import { PaymentSessionResolver } from './graphql/resolvers/payment-session.resolver';

/** The caller the request context answers with. */
const mockCaller: { tenantId: string | null; organizationId: string | null } = { tenantId: null, organizationId: null };

const TENANT = '00000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '00000000-0000-4000-8000-0000000000a1';
const REFUND_1 = '00000000-0000-4000-8000-0000000000e1';
const REFUND_2 = '00000000-0000-4000-8000-0000000000e2';

describe('toPaymentListOptions — the query string, split into find options and criterion', () => {
	it('reads withDeleted as a boolean, and forwards it only when it is true', () => {
		// The failure scenario of the finding: the string 'false' is truthy.
		expect(toPaymentListOptions({ withDeleted: 'false' })).toEqual({ where: {} });
		expect(toPaymentListOptions({ withDeleted: '0' })).toEqual({ where: {} });
		expect(toPaymentListOptions({ withDeleted: 'true' })).toEqual({ where: {}, withDeleted: true });
		expect(toPaymentListOptions({ withDeleted: '1' })).toEqual({ where: {}, withDeleted: true });
		expect(toPaymentListOptions({ withDeleted: true })).toEqual({ where: {}, withDeleted: true });
		expect(toPaymentListOptions({})).toEqual({ where: {} });
	});

	it('keeps a flat filter as a criterion, beside the bracketed spelling', () => {
		expect(toPaymentListOptions({ refundId: REFUND_1 })).toEqual({ where: { refundId: REFUND_1 } });
		expect(toPaymentListOptions({ where: { refundId: REFUND_1 } })).toEqual({ where: { refundId: REFUND_1 } });
		expect(toPaymentListOptions({ status: 'CAPTURED', where: { currency: 'EUR' } })).toEqual({
			where: { status: 'CAPTURED', currency: 'EUR' }
		});
		// The bracketed spelling is the explicit one, so it wins where both name the same column.
		expect(toPaymentListOptions({ status: 'PENDING', where: { status: 'CAPTURED' } })).toEqual({
			where: { status: 'CAPTURED' }
		});
	});

	it('reads the two boolean words of a criterion as booleans, and nothing else', () => {
		expect(toPaymentListOptions({ isEnabled: 'false', code: 'stripe', where: { isTestMode: 'true' } })).toEqual({
			where: { isEnabled: false, code: 'stripe', isTestMode: true }
		});
	});

	it('reads take and skip as whole numbers, skip being a row offset', () => {
		expect(toPaymentListOptions({ take: '5', skip: '2' })).toEqual({ where: {}, take: 5, skip: 2 });
		expect(toPaymentListOptions({ take: 5, skip: 0 })).toEqual({ where: {}, take: 5, skip: 0 });
		// An empty value is no value, as it is for the DTO's own optional members.
		expect(toPaymentListOptions({ take: '', skip: '' })).toEqual({ where: {} });
	});

	it('refuses a page it cannot read rather than reading another one', () => {
		for (const query of [
			{ take: 'ten' },
			{ take: '-1' },
			{ take: '2.5' },
			{ take: '101' },
			{ skip: '-3' },
			{ skip: 'x' }
		]) {
			expect(() => toPaymentListOptions(query)).toThrow(BadRequestException);
		}
		// The bound is the one `BaseQueryDTO` declares, and it is inclusive.
		expect(toPaymentListOptions({ take: '100' })).toMatchObject({ take: 100 });
	});

	it('refuses a where that is not a map of columns, rather than answering as if it had been honoured', () => {
		for (const where of ['{"status":"CAPTURED"}', [{ status: 'CAPTURED' }], null]) {
			expect(() => toPaymentListOptions({ where })).toThrow(BadRequestException);
		}
	});

	it('forwards order, relations and select as stated, and leaves out what was not', () => {
		expect(
			toPaymentListOptions({ order: { createdAt: 'DESC' }, relations: { session: true }, select: { id: true } })
		).toEqual({ where: {}, order: { createdAt: 'DESC' }, relations: { session: true }, select: { id: true } });
		expect(Object.keys(toPaymentListOptions(undefined))).toEqual(['where']);
		expect(Object.keys(toPaymentListOptions(null))).toEqual(['where']);
	});
});

/**
 * Every list route, over a stub of its own service: the service is handed the split options.
 */
describe('the eight payment list routes — each hands its service the split query', () => {
	const ROUTES = [
		{ name: 'PaymentProviderController', controller: PaymentProviderController, method: 'findProviders' },
		{ name: 'PaymentCollectionController', controller: PaymentCollectionController, method: 'findCollections' },
		{ name: 'PaymentSessionController', controller: PaymentSessionController, method: 'findSessions' },
		{ name: 'PaymentCaptureController', controller: PaymentCaptureController, method: 'findCaptures' },
		{ name: 'RefundController', controller: RefundController, method: 'findRefunds' },
		{ name: 'RefundReasonController', controller: RefundReasonController, method: 'findReasons' },
		{ name: 'RefundLineController', controller: RefundLineController, method: 'findLinesPage' },
		{ name: 'PaymentWebhookEventController', controller: PaymentWebhookEventController, method: 'findEvents' }
	] as const;

	it.each(ROUTES)('$name', async ({ controller, method }) => {
		const service = { [method]: jest.fn(async () => ({ items: [], total: 0 })) };
		const route = new (controller as new (service: unknown) => any)(service);

		// The query string of every finding at once, as Express's parser hands it over.
		await route.findAll({ withDeleted: 'false', refundId: REFUND_1, status: 'CAPTURED', take: '5', skip: '2' });

		expect(service[method]).toHaveBeenCalledTimes(1);
		// `toEqual`, so a `withDeleted` member forwarded at all — even as `false` — would fail here.
		expect(service[method]).toHaveBeenCalledWith({
			where: { refundId: REFUND_1, status: 'CAPTURED' },
			take: 5,
			skip: 2
		});

		// A malformed page is refused before the service is reached.
		await expect(route.findAll({ take: 'all' })).rejects.toThrow(BadRequestException);
		expect(service[method]).toHaveBeenCalledTimes(1);
	});
});

/**
 * The table the end-to-end cases read: the columns the four routes filter, order and scope on.
 */
@SoftDeletable(() => ListedRow, 'deletedAt', () => new Date())
@TypeOrmEntity('payment_list_fixture')
@MikroEntity({ tableName: 'payment_list_fixture' })
class ListedRow {
	@PrimaryColumn({ type: 'varchar' })
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Column({ type: 'varchar' })
	@Property({ type: 'string' })
	tenantId!: string;

	@Column({ type: 'varchar' })
	@Property({ type: 'string' })
	organizationId!: string;

	@Column({ type: 'varchar', nullable: true })
	@Property({ type: 'string', nullable: true })
	refundId?: string | null;

	@Column({ type: 'boolean' })
	@Property({ type: 'boolean' })
	isEnabled!: boolean;

	@Column({ type: 'int' })
	@Property({ type: 'integer' })
	amount!: number;

	@DeleteDateColumn({ nullable: true })
	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

/**
 * Twelve live rows of the caller's organization, amounts 1 to 12 so a page is readable by its amounts;
 * rows 1–4 belong to one refund and the rest to another, odd rows are enabled; and one retired row.
 */
const LIVE: ListedRow[] = Array.from({ length: 12 }, (_, index) => ({
	id: `00000000-0000-4000-8000-0000000001${String(index + 1).padStart(2, '0')}`,
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	refundId: index < 4 ? REFUND_1 : REFUND_2,
	isEnabled: index % 2 === 0,
	amount: index + 1,
	deletedAt: null
}));
const RETIRED: ListedRow = {
	id: '00000000-0000-4000-8000-000000000199',
	tenantId: TENANT,
	organizationId: ORGANIZATION,
	refundId: REFUND_1,
	isEnabled: true,
	amount: 99,
	deletedAt: null
};

const ORMS = ['typeorm', 'mikro-orm'] as const;

describe('the payment list routes, end to end on both ORM branches', () => {
	let dataSource: DataSource;
	let typeOrmRows: Repository<ListedRow>;
	let orm: MikroORM<BetterSqliteDriver>;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [ListedRow],
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: { null: 'sql-null', undefined: 'ignore' }
		});
		await dataSource.initialize();
		typeOrmRows = dataSource.getRepository(ListedRow);
		await typeOrmRows.save([...LIVE, RETIRED].map((row) => ({ ...row })));
		await typeOrmRows.softDelete(RETIRED.id);

		orm = await MikroORM.init<BetterSqliteDriver>({
			driver: BetterSqliteDriver,
			dbName: ':memory:',
			entities: [ListedRow],
			extensions: [SoftDeleteHandler],
			allowGlobalContext: true,
			discovery: { warnWhenNoEntities: false }
		});
		await orm.schema.createSchema();
		const em = orm.em.fork();
		for (const row of [...LIVE, RETIRED]) {
			em.persist(em.create(ListedRow, { ...row }));
		}
		await em.flush();
		// The production extension turns this removal into `UPDATE … SET deleted_at`.
		em.remove(await em.findOneOrFail(ListedRow, { id: RETIRED.id }));
		await em.flush();

		mockCaller.tenantId = TENANT;
		mockCaller.organizationId = ORGANIZATION;
	});

	afterAll(async () => {
		await dataSource?.destroy();
		await orm?.close(true);
	});

	afterEach(() => jest.restoreAllMocks());

	/** Selects one ORM branch and answers the two repositories the services are built over. */
	function repositories(ormType: (typeof ORMS)[number]): [unknown, unknown] {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType as never);

		return [typeOrmRows, new MikroOrmBaseEntityRepository<ListedRow>(orm.em.fork(), ListedRow)];
	}

	/** The amounts of a page, which is how its rows are named here. */
	const amounts = (page: { items: any[] }) => page.items.map((row) => Number(row.amount));

	describe.each(ORMS)('on the %s branch', (ormType) => {
		it('GET /payment-captures?withDeleted=false leaves the retired row out', async () => {
			const [typeOrm, mikroOrm] = repositories(ormType);
			const route = new PaymentCaptureController(
				new PaymentCaptureService(typeOrm as never, mikroOrm as never, {} as never, {} as never, {} as never)
			);

			const live = await route.findAll({ withDeleted: 'false' } as never);
			const all = await route.findAll({ withDeleted: 'true' } as never);

			expect(live.total).toBe(12);
			expect(amounts(live)).not.toContain(99);
			// A control: the retired row is there to be shown, and asking for it shows it.
			expect(all.total).toBe(13);
			expect(amounts(all)).toContain(99);
		});

		it('GET /refund-lines?refundId=R1 answers R1’s lines only', async () => {
			const [typeOrm, mikroOrm] = repositories(ormType);
			const route = new RefundLineController(new RefundLineService(typeOrm as never, mikroOrm as never));

			const page = await route.findAll({ refundId: REFUND_1, order: { amount: 'ASC' } } as never);

			expect(amounts(page)).toEqual([1, 2, 3, 4]);
			expect(page.total).toBe(4);
		});

		it('GET /payment-providers?isEnabled=false answers the disabled rows, on every dialect’s boolean', async () => {
			const [typeOrm, mikroOrm] = repositories(ormType);
			const route = new PaymentProviderController(
				new PaymentProviderService(typeOrm as never, mikroOrm as never)
			);

			const page = await route.findAll({ isEnabled: 'false', order: { amount: 'ASC' } } as never);

			expect(amounts(page)).toEqual([2, 4, 6, 8, 10, 12]);
		});

		it('GET /payment-sessions?take=5&skip=2 answers rows 3–7, the rows the connection answers for offset 2', async () => {
			const [typeOrm, mikroOrm] = repositories(ormType);
			const service = new PaymentSessionService(
				typeOrm as never,
				mikroOrm as never,
				{} as never,
				{} as never,
				{} as never
			);
			const route = new PaymentSessionController(service);
			const resolver = new PaymentSessionResolver(service);

			const page = await route.findAll({ take: '5', skip: '2', order: { amount: 'ASC' } } as never);
			const connection = await resolver.paymentSessions(undefined, { field: 'AMOUNT', direction: 'ASC' }, 5, 2);

			// `skip` is a row offset: two rows passed over, five answered — on both ORM branches.
			expect(amounts(page)).toEqual([3, 4, 5, 6, 7]);
			expect(page.total).toBe(12);
			// One question, two surfaces, one answer.
			expect(connection.nodes.map((row: any) => Number(row.amount))).toEqual(amounts(page));
		});
	});
});
