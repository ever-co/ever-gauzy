import '../core/entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { AccountingTemplateService } from './accounting-template.service';

/**
 * SD-5 — `accountingTemplates(withDeleted: true)` and the REST list route beside it answered exactly
 * the live rows they answered without the flag, on both ORMs: `findAll` builds its own reads and named
 * neither MikroORM's soft-delete filter nor TypeORM's `withDeleted`, so the flag the resolver forwards
 * never reached the store.
 *
 * Each case runs the service's real `findAll` against a real in-memory SQLite database under each ORM,
 * with the soft-delete mechanism each ORM uses in production — MikroORM's `@SoftDeletable` filter, and
 * TypeORM's delete-date column — so the assertion is about the rows the store answers, not about the
 * options object. Every case also carries a retired row of ANOTHER tenant, because lifting the
 * soft-delete predicate must never lift the tenant scope with it.
 */

const TENANT_A = '5d000000-0000-4000-8000-00000000000a';
const TENANT_B = '5d000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A = '5d000000-0000-4000-8000-0000000000a1';
const ORGANIZATION_B = '5d000000-0000-4000-8000-0000000000b1';
const RETIRED_AT = new Date('2026-01-01T00:00:00.000Z');

/** The rows every case reads, named so a leak names itself rather than moving a count. */
const SEED = [
	{ id: '5d000000-0000-4000-8000-000000000001', name: 'tenant-live', tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: null },
	{ id: '5d000000-0000-4000-8000-000000000002', name: 'tenant-retired', tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: RETIRED_AT },
	{ id: '5d000000-0000-4000-8000-000000000003', name: 'other-tenant-retired', tenantId: TENANT_B, organizationId: ORGANIZATION_B, deletedAt: RETIRED_AT },
	{ id: '5d000000-0000-4000-8000-000000000004', name: 'global-live', tenantId: null, organizationId: null, deletedAt: null },
	{ id: '5d000000-0000-4000-8000-000000000005', name: 'global-retired', tenantId: null, organizationId: null, deletedAt: RETIRED_AT }
].map((row) => ({ ...row, languageCode: 'en', templateType: 'INVOICE' }));

const OrganizationSchema = new EntitySchema({
	name: 'Organization',
	tableName: 'organization',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar', nullable: true },
		brandColor: { type: 'varchar', nullable: true }
	}
});

// `EntitySchema<any>`: the generic infers its column names from `columns`, so a `relations` key it does
// not know is a compile error otherwise. `deleteDate` is what makes a TypeORM query builder add its own
// `deletedAt IS NULL` — the predicate `withDeleted` lifts.
const AccountingTemplateSchema = new EntitySchema<any>({
	name: 'AccountingTemplate',
	tableName: 'accounting_template',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar' },
		languageCode: { type: 'varchar' },
		templateType: { type: 'varchar', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		organization: { type: 'many-to-one', target: 'Organization', joinColumn: { name: 'organizationId' } }
	}
});

/**
 * The same table for MikroORM, soft-deletable the way `SoftDeletableBaseEntity` is: the decorator
 * registers the default-on filter a read has to disable by name.
 */
@SoftDeletable(() => AccountingTemplateWithDeletedRow, 'deletedAt', () => new Date())
@Entity({ tableName: 'accounting_template' })
class AccountingTemplateWithDeletedRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string' })
	name!: string;

	@Property({ type: 'string' })
	languageCode!: string;

	@Property({ type: 'string', nullable: true })
	templateType?: string | null;

	@Property({ type: 'string', nullable: true })
	tenantId?: string | null;

	@Property({ type: 'string', nullable: true })
	organizationId?: string | null;

	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;
}

/** One ORM's database and the service reading it. */
interface IHarness {
	service(): AccountingTemplateService;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [OrganizationSchema, AccountingTemplateSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	await dataSource.getRepository('Organization').save([
		{ id: ORGANIZATION_A, name: 'Organization A' },
		{ id: ORGANIZATION_B, name: 'Organization B' }
	]);
	const templates: Repository<any> = dataSource.getRepository('AccountingTemplate');
	await templates.save(SEED);

	return {
		service: () => new AccountingTemplateService(templates as any, {} as any),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [AccountingTemplateWithDeletedRow],
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();

	const em = orm.em.fork();
	await em.persistAndFlush(SEED.map((row) => em.create(AccountingTemplateWithDeletedRow, row)));

	return {
		// A fresh fork per read, so a row is answered because the store answered it rather than because
		// the seeding context still held it.
		service: () =>
			new AccountingTemplateService({} as any, orm.em.fork().getRepository(AccountingTemplateWithDeletedRow) as any),
		close: () => orm.close(true)
	};
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
])('AccountingTemplateService.findAll honours withDeleted (%s)', (ormType, createHarness) => {
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
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The names of the rows one read answered, sorted. */
	const read = async (options: Record<string, unknown>): Promise<string[]> => {
		const { items, total } = await harness.service().findAll({ where: {}, ...options } as any);

		expect(total).toBe(items.length);
		return items.map((item: any) => item.name).sort();
	};

	it('answers the live rows of the caller tenant and the global defaults without the flag', async () => {
		expect(await read({})).toEqual(['global-live', 'tenant-live']);
	});

	it('answers the retired rows too when the caller asks for them', async () => {
		// The failure scenario: this answered ['global-live', 'tenant-live'] — the flag was dropped.
		expect(await read({ withDeleted: true })).toEqual([
			'global-live',
			'global-retired',
			'tenant-live',
			'tenant-retired'
		]);
	});

	it('never answers a retired row of another tenant, however the flag is stated', async () => {
		for (const withDeleted of [true, 'true']) {
			expect(await read({ withDeleted })).not.toContain('other-tenant-retired');
		}
	});

	it('reads the REST query string as a boolean, so "false" does not ask for retired rows', async () => {
		// The REST list route's pipe does not transform, so the flag arrives as text.
		expect(await read({ withDeleted: 'false' })).toEqual(['global-live', 'tenant-live']);
		expect(await read({ withDeleted: 'true' })).toContain('tenant-retired');
	});

	it('keeps the organization narrowing while the soft-delete predicate is lifted', async () => {
		expect(await read({ where: { organizationId: ORGANIZATION_B }, withDeleted: true })).toEqual([
			'global-live',
			'global-retired'
		]);
	});
});
