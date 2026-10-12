import '../entities/internal';

import { randomUUID } from 'node:crypto';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { EntitySchema as MikroEntitySchema, MikroORM } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { MultiORMEnum } from '../utils';
import { connectionFromOffsetPage, encodeOffsetCursor, resolveConnectionWindow } from '../../api/graphql-connection';
import { CrudService } from './crud.service';

/**
 * `findAll` and `find` read `skip` as a row offset under BOTH ORMs.
 *
 * The store-paged GraphQL connections hand `findAll` the offset `resolveConnectionWindow` resolved and label
 * the page as starting there. Under TypeORM that is what `skip` means; under MikroORM the read went through
 * the parser `paginate` uses, which reads `skip` as a page number — so `after: <offset 19>` with a page of 20
 * became `offset = 20 × (20 − 1) = 380`, and a walk over a 45-row list answered rows 0-19 and then nothing,
 * while the connection still said a next page existed. With `first: 1` the walk returned row 0 twice.
 *
 * Both ORMs are exercised against a real in-memory SQLite database with the same rows, because the defect is
 * in what the store is asked for: a mock repository would only restate whichever offset the code computed.
 * `paginate` is asserted too, because its page-number `skip` is a different contract and must not move.
 */

/** The group every row belongs to: a relation, because a joined read takes a different path in both ORMs. */
class WalkGroup {
	id!: string;
	name!: string;
}

/** The row every read below answers: a position to order by, and the tenancy the reads are scoped by. */
class WalkRow {
	id!: string;
	position!: number;
	tenantId!: string;
	group?: WalkGroup;
}

const TypeOrmWalkGroup = new EntitySchema<WalkGroup>({
	name: 'WalkGroup',
	tableName: 'walk_group',
	target: WalkGroup,
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' }
	}
});

const TypeOrmWalkRow = new EntitySchema<WalkRow>({
	name: 'WalkRow',
	tableName: 'walk_row',
	target: WalkRow,
	columns: {
		id: { primary: true, type: 'varchar' },
		position: { type: 'int' },
		tenantId: { type: 'varchar' }
	},
	relations: {
		group: { type: 'many-to-one', target: 'WalkGroup', nullable: true, joinColumn: { name: 'groupId' } }
	}
});

const MikroWalkGroup = new MikroEntitySchema<WalkGroup>({
	class: WalkGroup,
	tableName: 'walk_group',
	properties: {
		id: { type: 'string', primary: true },
		name: { type: 'string' }
	}
});

const MikroWalkRow = new MikroEntitySchema<WalkRow>({
	class: WalkRow,
	tableName: 'walk_row',
	properties: {
		id: { type: 'string', primary: true },
		position: { type: 'number' },
		tenantId: { type: 'string' },
		group: { kind: 'm:1', entity: () => WalkGroup, nullable: true }
	}
});

class WalkRowService extends CrudService<any> {
	constructor(typeOrmRepository: Repository<any>, mikroOrmRepository: any) {
		super(typeOrmRepository as any, mikroOrmRepository);
	}
}

/** The tenant whose 45 rows every read is scoped to, and a second tenant whose rows must never count. */
const TENANT = randomUUID();
const OTHER_TENANT = randomUUID();
const ROWS = 45;

/** The one group every row is filed under. */
const GROUP = { id: randomUUID(), name: 'the group' };

/** One ORM under test: the service wired to it, and the repository its MikroORM branch reads through. */
interface IOrmUnderTest {
	service: WalkRowService;
	mikroRepository?: { findAndCount: (...args: any[]) => any; find: (...args: any[]) => any };
	close(): Promise<void>;
}

/** The seeded rows, as each ORM persists them: every row filed under {@link GROUP}. */
function seedRows(): Array<Omit<WalkRow, 'group'>> {
	const own = Array.from({ length: ROWS }, (_, position) => ({ id: randomUUID(), position, tenantId: TENANT }));
	const foreign = Array.from({ length: 7 }, (_, position) => ({
		id: randomUUID(),
		position: 1000 + position,
		tenantId: OTHER_TENANT
	}));

	return [...own, ...foreign];
}

async function typeOrmUnderTest(): Promise<IOrmUnderTest> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [TypeOrmWalkGroup, TypeOrmWalkRow],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	await dataSource.getRepository<WalkGroup>('WalkGroup').save(GROUP);
	const repository = dataSource.getRepository<WalkRow>('WalkRow');
	await repository.save(seedRows().map((row) => ({ ...row, group: { id: GROUP.id } as WalkGroup })));

	return {
		service: new WalkRowService(repository, {}),
		close: async () => {
			await dataSource.destroy();
		}
	};
}

async function mikroOrmUnderTest(): Promise<IOrmUnderTest> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [MikroWalkGroup, MikroWalkRow],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.getSchemaGenerator().createSchema();

	const em = orm.em.fork();
	em.persist(em.create(WalkGroup, GROUP));
	em.persist(seedRows().map((row) => em.create(WalkRow, { ...row, group: GROUP.id } as any)));
	await em.flush();

	const repository = orm.em.fork().getRepository(WalkRow);

	return {
		service: new WalkRowService({} as any, repository),
		mikroRepository: repository as any,
		close: async () => {
			await orm.close(true);
		}
	};
}

/** The positions a page answered, which is what every assertion below is about. */
function positions(rows: readonly any[]): number[] {
	return rows.map((row) => row.position);
}

/** The tenant-scoped, ordered read every walk uses. */
const SCOPED = { where: { tenantId: TENANT }, order: { position: 'ASC' } } as const;

describe.each([
	['TypeORM', MultiORMEnum.TypeORM, typeOrmUnderTest],
	['MikroORM', MultiORMEnum.MikroORM, mikroOrmUnderTest]
] as const)('CrudService row windows under %s', (_label, ormType, open) => {
	let orm: IOrmUnderTest;

	beforeAll(async () => {
		orm = await open();
	});

	afterAll(async () => {
		await orm?.close();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads `skip` as the number of rows to pass over in findAll', async () => {
		const page = await orm.service.findAll({ ...SCOPED, skip: 20, take: 20 } as any);

		expect(positions(page.items)).toEqual(Array.from({ length: 20 }, (_, index) => 20 + index));
		expect(page.total).toBe(ROWS);
	});

	it('reads `skip` as the number of rows to pass over in find', async () => {
		const rows = await orm.service.find({ ...SCOPED, skip: 5, take: 3 } as any);

		expect(positions(rows)).toEqual([5, 6, 7]);
	});

	it('walks a connection page by page with the cursors it hands out, every row exactly once', async () => {
		// `first: 20`, then `after: endCursor` while `hasNextPage` holds — the walk a Relay client makes. The
		// second window is asserted to start at row 20, which is the page the connection labels.
		const seen: number[] = [];
		const starts: number[] = [];
		let after: string | null = null;

		for (let step = 0; step < 10; step++) {
			const window = resolveConnectionWindow({ first: 20, after });
			const listing = await orm.service.findAll({ ...SCOPED, skip: window.skip, take: window.take } as any);
			const connection = connectionFromOffsetPage(listing, window.skip, window.take);

			starts.push(window.skip);
			seen.push(...positions(connection.nodes));
			// Each row sits at the offset its cursor names, so a cursor handed back resumes exactly past it.
			connection.edges.forEach((edge, index) => {
				expect(edge.cursor).toBe(encodeOffsetCursor(window.skip + index));
				expect((edge.node as any).position).toBe(window.skip + index);
			});

			if (!connection.pageInfo.hasNextPage) {
				break;
			}
			after = connection.pageInfo.endCursor;
		}

		expect(starts).toEqual([0, 20, 40]);
		expect(seen).toEqual(Array.from({ length: ROWS }, (_, position) => position));
	});

	it('does not answer the first row twice to a walk one row at a time', async () => {
		const first = resolveConnectionWindow({ first: 1 });
		const firstPage = connectionFromOffsetPage(
			await orm.service.findAll({ ...SCOPED, skip: first.skip, take: first.take } as any),
			first.skip
		);
		const second = resolveConnectionWindow({ first: 1, after: firstPage.pageInfo.endCursor });
		const secondPage = await orm.service.findAll({ ...SCOPED, skip: second.skip, take: second.take } as any);

		expect(positions(firstPage.nodes)).toEqual([0]);
		expect(positions(secondPage.items)).toEqual([1]);
	});

	it('answers a backward walk with the rows before its cursor', async () => {
		const window = resolveConnectionWindow({ last: 5, before: encodeOffsetCursor(3) });
		const listing = await orm.service.findAll({ ...SCOPED, skip: window.skip, take: window.take } as any);

		expect(positions(listing.items)).toEqual([0, 1, 2]);
	});

	it('answers an empty window with the scoped count and no rows, rather than with every row', async () => {
		// `before: <offset 0>` resolves to `take: 0`. A zero limit is dropped by MikroORM and by TypeORM on a
		// joined read, so the window used to become an unbounded read of the table.
		const window = resolveConnectionWindow({ last: 5, before: encodeOffsetCursor(0) });
		expect(window).toEqual({ skip: 0, take: 0 });

		const listing = await orm.service.findAll({ ...SCOPED, skip: window.skip, take: window.take } as any);

		expect(listing.items).toEqual([]);
		// The count is the tenant's own: the other tenant's seven rows are not in it.
		expect(listing.total).toBe(ROWS);

		await expect(orm.service.find({ ...SCOPED, take: 0 } as any)).resolves.toEqual([]);
	});

	it('answers an empty window with no rows on a joined read too', async () => {
		// The path that was unbounded under BOTH ORMs: MikroORM drops a zero limit outright, and TypeORM drops
		// it once a relation is joined and no `skip` is stated.
		const joined = { ...SCOPED, relations: { group: true } };

		const listing = await orm.service.findAll({ ...joined, take: 0 } as any);
		expect(listing.items).toEqual([]);
		expect(listing.total).toBe(ROWS);

		await expect(orm.service.find({ ...joined, take: 0 } as any)).resolves.toEqual([]);
	});

	it('reads `skip` as a row offset on a joined read', async () => {
		const page = await orm.service.findAll({ ...SCOPED, relations: { group: true }, skip: 20, take: 20 } as any);

		expect(positions(page.items)).toEqual(Array.from({ length: 20 }, (_, index) => 20 + index));
		expect(page.items.every((row: any) => row.group?.id === GROUP.id)).toBe(true);
		expect(page.total).toBe(ROWS);
	});

	it('leaves an absent `take` unbounded, as it always was', async () => {
		const listing = await orm.service.findAll({ ...SCOPED } as any);

		expect(listing.items).toHaveLength(ROWS);
		expect(listing.total).toBe(ROWS);
	});

	it('keeps `paginate` on its page-number `skip`', async () => {
		// A different contract, deliberately untouched: page 2 of 20 is rows 20-39 on both ORMs.
		const page = await orm.service.paginate({ ...SCOPED, skip: 2, take: 20 } as any);

		expect(positions(page.items)).toEqual(Array.from({ length: 20 }, (_, index) => 20 + index));
		expect(page.total).toBe(ROWS);
	});
});

/**
 * What the MikroORM branch asks the store for, observed at the repository.
 *
 * The walks above prove the answers; these prove the request, because an offset that happened to land on
 * the right rows for one fixture is not the same as the offset the caller stated.
 */
describe('CrudService row windows — the MikroORM store call', () => {
	let orm: IOrmUnderTest;

	beforeAll(async () => {
		orm = await mikroOrmUnderTest();
	});

	afterAll(async () => {
		await orm?.close();
	});

	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
	});

	afterEach(() => jest.restoreAllMocks());

	it('asks the store for the stated offset itself, not a page number multiplied out', async () => {
		// The store call is observed as well as its answer: `offset: 20` is what the connection labels the
		// page with, and the value the MikroORM branch used to send for this call was 380.
		const findAndCount = jest.spyOn(orm.mikroRepository!, 'findAndCount');
		const find = jest.spyOn(orm.mikroRepository!, 'find');

		await orm.service.findAll({ ...SCOPED, skip: 20, take: 20 } as any);
		await orm.service.find({ ...SCOPED, skip: 1, take: 1 } as any);
		await orm.service.findAll({ ...SCOPED, take: 20 } as any);

		expect(findAndCount.mock.calls[0][1]).toMatchObject({ offset: 20, limit: 20 });
		expect(find.mock.calls[0][1]).toMatchObject({ offset: 1, limit: 1 });
		expect(findAndCount.mock.calls[1][1].offset).toBeUndefined();
	});

	it('bounds the read an empty window issues to a single row', async () => {
		const findAndCount = jest.spyOn(orm.mikroRepository!, 'findAndCount');
		const find = jest.spyOn(orm.mikroRepository!, 'find');

		await orm.service.findAll({ ...SCOPED, take: 0 } as any);
		await orm.service.find({ ...SCOPED, take: 0 } as any);

		expect(findAndCount.mock.calls[0][1]).toMatchObject({ limit: 1 });
		expect(find).not.toHaveBeenCalled();
	});
});
