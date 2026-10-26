import '../core/entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { PermissionsEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { OrganizationTeamService } from './organization-team.service';

/**
 * SD-4 — `organizationTeams(withDeleted: true)`, and the REST list route through the same `findAll`,
 * answered retired teams on MikroORM and never on TypeORM: the MikroORM branch converts the options
 * with `parseTypeORMFindToMikroOrm`, which disables the soft-delete filter, while the TypeORM branch
 * builds its own query builder and handed `setFindOptions` everything but `withDeleted`, so the
 * builder's own `deletedAt IS NULL` stayed. The same request got two answers depending on `DB_ORM`.
 *
 * Each case runs the service's real `findAll` against a real in-memory SQLite database under each ORM,
 * with the soft-delete mechanism each ORM uses in production — MikroORM's `@SoftDeletable` filter, and
 * TypeORM's delete-date column. The caller holds `CHANGE_SELECTED_EMPLOYEE`, which is the branch both
 * ORMs can run on SQLite: the member-restricted MikroORM branch issues Postgres-only SQL. Every case
 * carries a retired team of another organization and one of another tenant, because lifting the
 * soft-delete predicate must lift nothing else.
 */

const TENANT_A = '60000000-0000-4000-8000-00000000000a';
const TENANT_B = '60000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A = '60000000-0000-4000-8000-0000000000a1';
const ORGANIZATION_B = '60000000-0000-4000-8000-0000000000b1';
const RETIRED_AT = new Date('2026-01-01T00:00:00.000Z');

/** The teams every case reads, named so a leak names itself rather than moving a count. */
const SEED = [
	{ id: '60000000-0000-4000-8000-000000000001', name: 'live', tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: null },
	{ id: '60000000-0000-4000-8000-000000000002', name: 'retired', tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: RETIRED_AT },
	{ id: '60000000-0000-4000-8000-000000000003', name: 'retired-other-organization', tenantId: TENANT_A, organizationId: ORGANIZATION_B, deletedAt: RETIRED_AT },
	{ id: '60000000-0000-4000-8000-000000000004', name: 'retired-other-tenant', tenantId: TENANT_B, organizationId: ORGANIZATION_A, deletedAt: RETIRED_AT }
];

// `deleteDate` is what makes a TypeORM query builder add its own `deletedAt IS NULL` — the predicate
// `withDeleted` lifts.
const OrganizationTeamSchema = new EntitySchema<any>({
	name: 'OrganizationTeam',
	tableName: 'organization_team',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

/**
 * The same table for MikroORM, soft-deletable the way `SoftDeletableBaseEntity` is: the decorator
 * registers the default-on filter a read has to disable by name.
 */
@SoftDeletable(() => OrganizationTeamWithDeletedRow, 'deletedAt', () => new Date())
@Entity({ tableName: 'organization_team' })
class OrganizationTeamWithDeletedRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string' })
	name!: string;

	@Property({ type: 'string', nullable: true })
	tenantId?: string | null;

	@Property({ type: 'string', nullable: true })
	organizationId?: string | null;

	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

/**
 * The service over one ORM's repository. The collaborators it names are never reached by `findAll`,
 * so they are empty objects: a read that did reach one would fail loudly rather than pass silently.
 */
function serviceOver(typeOrmRepository: unknown, mikroOrmRepository: unknown): OrganizationTeamService {
	return new OrganizationTeamService(
		typeOrmRepository as any,
		mikroOrmRepository as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any
	);
}

/** One ORM's database and the service reading it. */
interface IHarness {
	service(): OrganizationTeamService;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [OrganizationTeamSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const teams: Repository<any> = dataSource.getRepository('OrganizationTeam');
	await teams.save(SEED);

	return {
		service: () => serviceOver(teams, {}),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [OrganizationTeamWithDeletedRow],
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();

	const em = orm.em.fork();
	await em.persistAndFlush(SEED.map((row) => em.create(OrganizationTeamWithDeletedRow, row)));

	return {
		// A fresh fork per read, so a row is answered because the store answered it rather than because
		// the seeding context still held it.
		service: () => serviceOver({}, orm.em.fork().getRepository(OrganizationTeamWithDeletedRow)),
		close: () => orm.close(true)
	};
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
])('OrganizationTeamService.findAll honours withDeleted (%s)', (ormType, createHarness) => {
	let harness: IHarness;

	beforeAll(async () => {
		harness = await createHarness();
	});

	afterAll(async () => {
		await harness?.close();
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_A);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
			(permission: PermissionsEnum) => permission === PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The teams one read of the caller's organization answered, sorted. */
	const read = async (options: Record<string, unknown>): Promise<string[]> => {
		const { items, total } = await harness
			.service()
			.findAll({ where: { organizationId: ORGANIZATION_A }, ...options } as any);

		expect(total).toBe(items.length);
		return items.map((item: any) => item.name).sort();
	};

	it('answers the live teams of the caller organization without the flag', async () => {
		expect(await read({})).toEqual(['live']);
	});

	it('answers the retired teams too when the caller asks for them, on both ORMs alike', async () => {
		// The failure scenario: on TypeORM this answered ['live'] while MikroORM answered both.
		expect(await read({ withDeleted: true })).toEqual(['live', 'retired']);
	});

	it('never answers a retired team of another organization or another tenant', async () => {
		for (const withDeleted of [true, 'true']) {
			const answered = await read({ withDeleted });

			expect(answered).not.toContain('retired-other-organization');
			expect(answered).not.toContain('retired-other-tenant');
		}
	});

	it('reads the REST query string as a boolean, so "false" does not ask for retired teams', async () => {
		// The REST list route's pipe does not transform, so the flag arrives as text — and the MikroORM
		// converter used to read the non-empty string 'false' as a request for the retired rows.
		expect(await read({ withDeleted: 'false' })).toEqual(['live']);
		expect(await read({ withDeleted: 'true' })).toEqual(['live', 'retired']);
	});
});
