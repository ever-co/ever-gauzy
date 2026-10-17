import '../entities/internal';

import { NotFoundException } from '@nestjs/common';
import {
	Column,
	DataSource,
	DataSourceOptions,
	DeleteDateColumn,
	Entity,
	FindOperator,
	Logger,
	ManyToOne,
	PrimaryGeneratedColumn,
	RelationId,
	Repository
} from 'typeorm';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../context';
import { MultiORMEnum } from '../utils';
import { CrudService } from './crud.service';
import { TenantAwareCrudService } from './tenant-aware-crud.service';

/**
 * How `TenantAwareCrudService` scopes a TypeORM READ: by the foreign-key column and an `EXISTS` on the
 * referenced tenant (or employee), not by the relation `{ tenant: { id } }` it scopes writes with.
 *
 * **The cost being removed.** TypeORM resolves `{ tenant: { id } }` with a LEFT JOIN on the tenant, and a
 * statement with a join and a `take` or `skip` is paged in two: `SELECT DISTINCT` ids under the limit, then
 * the rows `IN` those ids. Every `findOne` is a `take: 1`, so a scoped lookup by id was two statements and a
 * scoped page three. The cases below count the statements TypeORM sends to a real better-sqlite3 store, for
 * the shape the service now builds and — as the CONTROL that proves the count discriminates — for the joined
 * shape it built before.
 *
 * **The rows that must not change.** The join hid the rows whose tenant or employee is soft-deleted (its ON
 * clause carries `deletedAt IS NULL`), and showed them again under `withDeleted`. Each such case is answered
 * by both shapes against the same store and compared, besides being stated outright.
 *
 * **What must not move at all.** Writes keep the joined shape's members — the stamps on created rows and the
 * criteria of updates — and so does every read that does not run on TypeORM, or that the metadata cannot
 * describe.
 */

@Entity('read_scope_tenant')
class ReadScopeTenant {
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@DeleteDateColumn({ nullable: true })
	deletedAt?: Date;
}

@Entity('read_scope_employee')
class ReadScopeEmployee {
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@DeleteDateColumn({ nullable: true })
	deletedAt?: Date;
}

/** Declared as `TenantBaseEntity` / `TenantOrganizationBaseEntity` declare it: the relation, and its id beside it. */
@Entity('read_scope_row')
class ReadScopeRow {
	@PrimaryGeneratedColumn('uuid')
	id?: string;

	@DeleteDateColumn({ nullable: true })
	deletedAt?: Date;

	@Column({ type: 'varchar', nullable: true })
	name?: string;

	@ManyToOne(() => ReadScopeTenant, { nullable: true, onDelete: 'CASCADE' })
	tenant?: ReadScopeTenant;

	@RelationId((row: ReadScopeRow) => row.tenant)
	@Column({ type: 'varchar', nullable: true })
	tenantId?: string;

	@ManyToOne(() => ReadScopeEmployee, { nullable: true, onDelete: 'CASCADE' })
	employee?: ReadScopeEmployee;

	@RelationId((row: ReadScopeRow) => row.employee)
	@Column({ type: 'varchar', nullable: true })
	employeeId?: string;
}

const ENTITIES = [ReadScopeTenant, ReadScopeEmployee, ReadScopeRow];

/** The caller's tenant, a soft-deleted tenant, and another live tenant. */
const TENANT_A = '7e000000-0000-4000-8000-00000000000a';
const TENANT_RETIRED = '7e000000-0000-4000-8000-00000000000d';
const TENANT_B = '7e000000-0000-4000-8000-00000000000b';

/** A live employee of tenant A, and a soft-deleted one. */
const EMPLOYEE_1 = '7e000000-0000-4000-8000-0000000000e1';
const EMPLOYEE_RETIRED = '7e000000-0000-4000-8000-0000000000ed';

/** Rows of tenant A (one of them soft-deleted itself), of the retired tenant, and of tenant B. */
const A_EMPLOYEE_1 = '7e000000-0000-4000-8000-000000000001';
const A_RETIRED_EMPLOYEE = '7e000000-0000-4000-8000-000000000002';
const A_RETIRED_ROW = '7e000000-0000-4000-8000-000000000003';
const OF_RETIRED_TENANT = '7e000000-0000-4000-8000-000000000004';
const OF_TENANT_B = '7e000000-0000-4000-8000-000000000005';

const RETIRED_AT = '2026-01-01 00:00:00.000';

/** The predicate every scoped read carries for the caller's tenant, as SQLite is sent it. */
const LIVE_TENANT_PREDICATE =
	'EXISTS (SELECT 1 FROM "read_scope_tenant" "tenant_scope" WHERE "tenant_scope"."id" = "ReadScopeRow"."tenantId" AND "tenant_scope"."deletedAt" IS NULL)';

/** Records every statement TypeORM sends. */
class StatementLog implements Logger {
	readonly statements: string[] = [];

	logQuery(query: string): void {
		this.statements.push(query);
	}
	logQueryError(): void {}
	logQuerySlow(): void {}
	logSchemaBuild(): void {}
	logMigration(): void {}
	log(): void {}

	/** The statements sent while `run` ran. */
	async during(run: () => Promise<unknown>): Promise<string[]> {
		this.statements.length = 0;
		await run();
		return [...this.statements];
	}
}

class ReadScopeRowService extends TenantAwareCrudService<any> {
	constructor(typeOrmRepository: unknown, mikroOrmRepository: unknown = {}) {
		super(typeOrmRepository as any, mikroOrmRepository as any);
	}

	/** The conditions a read is scoped with. */
	readConditions(withDeleted = false): Record<string, unknown> {
		return this['findConditionsWithTenantByUser'](RequestContext.currentUser(), { withDeleted });
	}

	/** The conditions a write's criteria are scoped with. */
	writeConditions(): Record<string, unknown> {
		return this['findConditionsWithTenantByUser'](RequestContext.currentUser());
	}

	scalars(conditions: Record<string, unknown>): Record<string, unknown> {
		return this['scalarConditions'](conditions);
	}
}

/** The caller the request context answers with; each case may narrow it. */
const caller: { tenantId: string; employeeId: string | null; mayChangeEmployee: boolean } = {
	tenantId: TENANT_A,
	employeeId: null,
	mayChangeEmployee: true
};

/** The ids a read answered, sorted. */
const idsOf = (rows: ReadonlyArray<{ id?: string }>): string[] => rows.map((row) => row.id).sort();

/** The joined shape the service scoped reads with before: the relation by its id, and the column. */
const joinedShape = (): Record<string, unknown> => ({
	tenant: { id: caller.tenantId },
	tenantId: caller.tenantId,
	...(caller.employeeId && !caller.mayChangeEmployee
		? { employee: { id: caller.employeeId }, employeeId: caller.employeeId }
		: {})
});

/** Runs the service on TypeORM, for the caller above. */
function mockRequestContext(): void {
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
	jest.spyOn(RequestContext, 'currentUser').mockImplementation(
		() => ({ id: 'user-a', tenantId: caller.tenantId }) as any
	);
	jest.spyOn(RequestContext, 'currentTenantId').mockImplementation(() => caller.tenantId);
	jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() => caller.employeeId);
	jest.spyOn(RequestContext, 'hasPermission').mockImplementation(() => caller.mayChangeEmployee);
}

function resetCaller(): void {
	caller.tenantId = TENANT_A;
	caller.employeeId = null;
	caller.mayChangeEmployee = true;
}

describe('TenantAwareCrudService scopes a TypeORM read without joining the tenant or the employee', () => {
	const log = new StatementLog();
	let dataSource: DataSource;
	let rows: Repository<ReadScopeRow>;
	let service: ReadScopeRowService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: ENTITIES,
			synchronize: true,
			logger: log,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();

		const insert = (table: string, id: string, deletedAt: string | null = null) =>
			dataSource.query(`INSERT INTO ${table} (id, deletedAt) VALUES (?, ?)`, [id, deletedAt]);
		await insert('read_scope_tenant', TENANT_A);
		await insert('read_scope_tenant', TENANT_RETIRED, RETIRED_AT);
		await insert('read_scope_tenant', TENANT_B);
		await insert('read_scope_employee', EMPLOYEE_1);
		await insert('read_scope_employee', EMPLOYEE_RETIRED, RETIRED_AT);

		rows = dataSource.getRepository(ReadScopeRow);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		await dataSource.query('DELETE FROM read_scope_row');
		const seed: Array<[string, string, string | null, string | null]> = [
			[A_EMPLOYEE_1, TENANT_A, EMPLOYEE_1, null],
			[A_RETIRED_EMPLOYEE, TENANT_A, EMPLOYEE_RETIRED, null],
			[A_RETIRED_ROW, TENANT_A, EMPLOYEE_1, RETIRED_AT],
			[OF_RETIRED_TENANT, TENANT_RETIRED, null, null],
			[OF_TENANT_B, TENANT_B, null, null]
		];
		for (const [id, tenantId, employeeId, deletedAt] of seed) {
			await dataSource.query(
				'INSERT INTO read_scope_row (id, name, tenantId, employeeId, deletedAt) VALUES (?, ?, ?, ?, ?)',
				[id, 'shared', tenantId, employeeId, deletedAt]
			);
		}

		resetCaller();
		mockRequestContext();
		service = new ReadScopeRowService(rows);
	});

	afterEach(() => jest.restoreAllMocks());

	/*
	|--------------------------------------------------------------------------
	| Statements
	|--------------------------------------------------------------------------
	*/

	it('finds a row by id in one statement, with no join and no DISTINCT', async () => {
		let found: ReadScopeRow;
		const statements = await log.during(async () => {
			found = await service.findOneByIdString(A_EMPLOYEE_1);
		});

		expect(found.id).toBe(A_EMPLOYEE_1);
		expect(statements).toHaveLength(1);
		expect(statements[0]).not.toMatch(/\bJOIN\b/i);
		expect(statements[0]).not.toMatch(/\bDISTINCT\b/i);
		expect(statements[0]).toContain(LIVE_TENANT_PREDICATE);
		expect(statements[0]).toContain('"ReadScopeRow"."tenantId" = ?');
	});

	it('CONTROL: the joined shape finds the same row in two statements, the first a DISTINCT over a LEFT JOIN', async () => {
		let found: ReadScopeRow;
		const statements = await log.during(async () => {
			found = await rows.findOne({ where: { id: A_EMPLOYEE_1, ...joinedShape() } });
		});

		expect(found.id).toBe(A_EMPLOYEE_1);
		expect(statements).toHaveLength(2);
		expect(statements[0]).toMatch(/^SELECT DISTINCT/);
		expect(statements[0]).toMatch(/LEFT JOIN "read_scope_tenant"/);
		expect(statements[0]).toContain('"deletedAt" IS NULL');
		expect(statements[1]).toContain('IN (?)');
	});

	// A page of one row out of two, so that TypeORM has to count: a first page shorter than `take` is counted
	// from the rows it holds, without a statement.
	it('pages in one statement plus the count, neither of them joined', async () => {
		let page: { items: ReadScopeRow[]; total: number };
		const statements = await log.during(async () => {
			page = await service.paginate({ take: 1 } as any);
		});

		expect(page.items).toHaveLength(1);
		expect(page.total).toBe(2);
		expect(statements).toHaveLength(2);
		for (const statement of statements) {
			expect(statement).not.toMatch(/\bJOIN\b/i);
			expect(statement).toContain(LIVE_TENANT_PREDICATE);
		}
		expect(statements[0]).not.toMatch(/\bDISTINCT\b/i);
		// The joined shape's id query ordered by primary key when the caller gave no order; the page keeps that.
		expect(statements[0]).toMatch(/ORDER BY "ReadScopeRow"\."id" ASC LIMIT 1 OFFSET 0$/);
		expect(statements[1]).toMatch(/^SELECT COUNT\(/);
	});

	it("keeps a caller's own order on a page", async () => {
		const statements = await log.during(async () => {
			await service.paginate({ take: 1, order: { name: 'DESC' } } as any);
		});
		expect(statements[0]).toMatch(/ORDER BY "ReadScopeRow"\."name" DESC LIMIT 1 OFFSET 0$/);
	});

	it('CONTROL: the joined shape pages in three statements, counting over the join', async () => {
		let result: [ReadScopeRow[], number];
		const statements = await log.during(async () => {
			result = await rows.findAndCount({ where: joinedShape(), skip: 0, take: 1 });
		});

		expect(result[0]).toHaveLength(1);
		expect(result[1]).toBe(2);
		expect(statements).toHaveLength(3);
		expect(statements[0]).toMatch(/^SELECT DISTINCT/);
		expect(statements[1]).toContain('IN (?)');
		expect(statements[2]).toMatch(/COUNT\(DISTINCT/);
		expect(statements[2]).toMatch(/LEFT JOIN "read_scope_tenant"/);
	});

	it('reads by conditions, counts and lists in one statement each, with no join', async () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;

		const statements = await log.during(async () => {
			await service.findOneByWhereOptions({ name: 'shared' } as any);
			await service.findOneByOptions({ where: { name: 'shared' } } as any);
			await service.countBy({ name: 'shared' } as any);
			await service.count();
			await service.find({ take: 5 } as any);
		});

		expect(statements).toHaveLength(5);
		for (const statement of statements) {
			expect(statement).not.toMatch(/\bJOIN\b/i);
			expect(statement).toContain(LIVE_TENANT_PREDICATE);
			expect(statement).toContain(
				'EXISTS (SELECT 1 FROM "read_scope_employee" "employee_scope" WHERE "employee_scope"."id" = "ReadScopeRow"."employeeId" AND "employee_scope"."deletedAt" IS NULL)'
			);
		}
	});

	/*
	|--------------------------------------------------------------------------
	| Rows
	|--------------------------------------------------------------------------
	*/

	it.each([
		["the caller's live tenant", TENANT_A, false, [A_EMPLOYEE_1, A_RETIRED_EMPLOYEE]],
		['a soft-deleted tenant', TENANT_RETIRED, false, []],
		["the caller's live tenant, withDeleted", TENANT_A, true, [A_EMPLOYEE_1, A_RETIRED_EMPLOYEE, A_RETIRED_ROW]],
		['a soft-deleted tenant, withDeleted', TENANT_RETIRED, true, [OF_RETIRED_TENANT]]
	] as const)('answers the rows the joined shape answered: %s', async (_label, tenantId, withDeleted, expected) => {
		caller.tenantId = tenantId;

		const now = idsOf(await service.find({ withDeleted } as any));
		const before = idsOf(await rows.find({ where: joinedShape(), withDeleted }));

		expect(now).toEqual([...expected].sort());
		expect(now).toEqual(before);
	});

	it.each([
		['a live employee', EMPLOYEE_1, false, [A_EMPLOYEE_1]],
		['a soft-deleted employee', EMPLOYEE_RETIRED, false, []],
		['a live employee, withDeleted', EMPLOYEE_1, true, [A_EMPLOYEE_1, A_RETIRED_ROW]],
		['a soft-deleted employee, withDeleted', EMPLOYEE_RETIRED, true, [A_RETIRED_EMPLOYEE]]
	] as const)(
		'answers the rows the joined shape answered for a caller scoped to %s',
		async (_label, employeeId, withDeleted, expected) => {
			caller.employeeId = employeeId;
			caller.mayChangeEmployee = false;

			const now = idsOf(await service.find({ withDeleted } as any));
			const paged = await service.paginate({ take: 10, withDeleted } as any);
			const before = idsOf(await rows.find({ where: joinedShape(), withDeleted }));

			expect(now).toEqual([...expected].sort());
			expect(idsOf(paged.items)).toEqual(now);
			expect(paged.total).toBe(now.length);
			expect(now).toEqual(before);
		}
	);

	it("reads `withDeleted` as every read entry point does: the string 'false' is a read of live rows", async () => {
		caller.tenantId = TENANT_RETIRED;

		await expect(service.find({ withDeleted: 'false' } as any)).resolves.toEqual([]);
		expect(idsOf(await service.find({ withDeleted: 'true' } as any))).toEqual([OF_RETIRED_TENANT]);
	});

	it("answers a row of a soft-deleted tenant as not found, as the join did, and another tenant's row too", async () => {
		caller.tenantId = TENANT_RETIRED;
		await expect(service.findOneByIdString(OF_RETIRED_TENANT)).rejects.toThrow(NotFoundException);
		await expect(rows.findOne({ where: { id: OF_RETIRED_TENANT, ...joinedShape() } })).resolves.toBeNull();

		caller.tenantId = TENANT_A;
		await expect(service.findOneByIdString(OF_TENANT_B)).rejects.toThrow(NotFoundException);
		await expect(service.findOneByWhereOptions({ id: OF_TENANT_B } as any)).rejects.toThrow(NotFoundException);
	});

	it("keeps overwriting a tenant or employee the caller's criteria name", async () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;

		const found = await service.find({
			where: { tenant: { id: TENANT_B }, tenantId: TENANT_B, employee: { id: EMPLOYEE_RETIRED } }
		} as any);
		const anyOf = await service.find({ where: [{ id: OF_TENANT_B }, { id: A_EMPLOYEE_1 }] } as any);

		expect(idsOf(found)).toEqual([A_EMPLOYEE_1]);
		expect(idsOf(anyOf)).toEqual([A_EMPLOYEE_1]);
	});

	/*
	|--------------------------------------------------------------------------
	| Writes keep the joined shape
	|--------------------------------------------------------------------------
	*/

	it('builds the read conditions with the predicate, and the write conditions as before', () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;

		const read = service.readConditions();
		expect(read.tenant).toBeInstanceOf(FindOperator);
		expect((read.tenant as FindOperator<unknown>).type).toBe('raw');
		expect(read.employee).toBeInstanceOf(FindOperator);
		expect(read).toMatchObject({ tenantId: TENANT_A, employeeId: EMPLOYEE_1 });

		expect(service.writeConditions()).toEqual({
			tenant: { id: TENANT_A },
			tenantId: TENANT_A,
			employee: { id: EMPLOYEE_1 },
			employeeId: EMPLOYEE_1
		});
	});

	it('drops the predicate from the scalar conditions an UPDATE is scoped by, as it dropped the relation', () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;

		const expected = { tenantId: TENANT_A, employeeId: EMPLOYEE_1 };
		expect(service.scalars(service.readConditions())).toEqual(expected);
		expect(service.scalars(service.writeConditions())).toEqual(expected);
	});

	it('stamps created rows with the relation and the column, as before', async () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;
		const create = jest.spyOn(rows, 'create');

		const created = await service.create({ name: 'created' } as any);

		expect(create).toHaveBeenCalledWith({
			name: 'created',
			tenant: { id: TENANT_A },
			tenantId: TENANT_A,
			employee: { id: EMPLOYEE_1 },
			employeeId: EMPLOYEE_1
		});
		const [stored] = await dataSource.query('SELECT tenantId, employeeId FROM read_scope_row WHERE id = ?', [
			created.id
		]);
		expect(stored).toEqual({ tenantId: TENANT_A, employeeId: EMPLOYEE_1 });
	});

	it('scopes the UPDATE and the DELETE criteria by the columns and relations they were scoped by before', async () => {
		caller.employeeId = EMPLOYEE_1;
		caller.mayChangeEmployee = false;
		const update = jest.spyOn(rows, 'update');
		const remove = jest.spyOn(rows, 'delete');

		await service.update(A_EMPLOYEE_1, { name: 'renamed' } as any);
		await service.delete(A_EMPLOYEE_1);

		expect(update).toHaveBeenCalledWith(
			{ tenantId: TENANT_A, employeeId: EMPLOYEE_1, id: A_EMPLOYEE_1 },
			{ name: 'renamed' }
		);
		expect(remove).toHaveBeenCalledWith({
			id: A_EMPLOYEE_1,
			tenant: { id: TENANT_A },
			tenantId: TENANT_A,
			employee: { id: EMPLOYEE_1 },
			employeeId: EMPLOYEE_1
		});
	});

	/*
	|--------------------------------------------------------------------------
	| Where the joined shape stays
	|--------------------------------------------------------------------------
	*/

	it('keeps the joined shape for a read that does not run on TypeORM', () => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);

		expect(service.readConditions()).toEqual({ tenant: { id: TENANT_A }, tenantId: TENANT_A });
	});

	it.each([
		['undefined', undefined],
		['null', null]
	])('keeps the joined shape for a caller whose tenant is %s', (_label, tenantId) => {
		caller.tenantId = tenantId as any;

		expect(service.readConditions()).toEqual({ tenant: { id: tenantId }, tenantId });
	});

	it('keeps the joined shape over a repository whose metadata cannot describe the relation', () => {
		const stub = new ReadScopeRowService({ metadata: { hasColumnWithPropertyPath: () => true } });

		expect(stub.readConditions()).toEqual({ tenant: { id: TENANT_A }, tenantId: TENANT_A });
	});
});

/**
 * The predicate on the databases the platform runs on besides SQLite, rendered without a server: the
 * metadata is built for the driver, and the query is rendered, not run. The statement has no join, so
 * TypeORM has no reason to page it in two.
 */
describe.each([
	[
		'PostgreSQL',
		{ type: 'postgres' },
		'EXISTS (SELECT 1 FROM "read_scope_tenant" "tenant_scope" WHERE "tenant_scope"."id" = "ReadScopeRow"."tenantId" AND "tenant_scope"."deletedAt" IS NULL)'
	],
	[
		'MySQL',
		{ type: 'mysql', database: 'gauzy' },
		'EXISTS (SELECT 1 FROM `read_scope_tenant` `tenant_scope` WHERE `tenant_scope`.`id` = `ReadScopeRow`.`tenantId` AND `tenant_scope`.`deletedAt` IS NULL)'
	]
] as const)('TenantAwareCrudService read scope on %s', (_label, options, predicate) => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			...(options as DataSourceOptions),
			entities: ENTITIES,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		} as DataSourceOptions);
		// What `initialize()` does once connected, without the connection: there is no server to connect to.
		await (dataSource as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
	});

	beforeEach(() => {
		resetCaller();
		mockRequestContext();
	});

	afterEach(() => jest.restoreAllMocks());

	it('renders the scoped read with the driver’s quoting, and without a join', () => {
		const service = new ReadScopeRowService(dataSource.getRepository(ReadScopeRow));
		const query = dataSource
			.getRepository(ReadScopeRow)
			.createQueryBuilder('ReadScopeRow')
			.setFindOptions({ where: service.readConditions() as any, take: 1 });

		const sql = query.getQuery();

		expect(sql).toContain(predicate);
		expect(sql).not.toMatch(/\bJOIN\b/i);
		expect(query.expressionMap.joinAttributes).toHaveLength(0);
	});

	it('leaves the soft-delete condition out under withDeleted, as the join did', () => {
		const service = new ReadScopeRowService(dataSource.getRepository(ReadScopeRow));
		const sql = dataSource
			.getRepository(ReadScopeRow)
			.createQueryBuilder('ReadScopeRow')
			.setFindOptions({ where: service.readConditions(true) as any, withDeleted: true })
			.getQuery();

		expect(sql).toContain(predicate.replace(/ AND \S+ IS NULL\)$/, ')'));
		expect(sql).not.toMatch(/deletedAt.{0,3} IS NULL/);
	});
});
