import '../core/entities/internal';

import { DataSource, EntitySchema, Repository } from 'typeorm';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { Entity, ManyToOne, MikroORM, PrimaryKey, Property } from '@mikro-orm/core';
import { SoftDeletable, SoftDeleteHandler } from 'mikro-orm-soft-delete';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { EmailHistoryService } from './email-history.service';

/**
 * SD-6 — `emailHistories(withDeleted: true)` and the REST list route beside it answered exactly the
 * live rows they answered without the flag, on both ORMs: `findAll` builds its own reads and named
 * neither MikroORM's soft-delete filter nor TypeORM's `withDeleted`, so the flag the resolver forwards
 * never reached the store.
 *
 * Each case runs the service's real `findAll` against a real in-memory SQLite database under each ORM,
 * with the soft-delete mechanism each ORM uses in production — MikroORM's `@SoftDeletable` filter, and
 * TypeORM's delete-date column — and with the two relations the read joins or populates, so the query
 * is the one the service issues. Every case carries a retired row of another organization of the same
 * tenant and one of another tenant, because lifting the soft-delete predicate must lift nothing else.
 */

const TENANT_A = '5f000000-0000-4000-8000-00000000000a';
const TENANT_B = '5f000000-0000-4000-8000-00000000000b';
const ORGANIZATION_A = '5f000000-0000-4000-8000-0000000000a1';
const ORGANIZATION_B = '5f000000-0000-4000-8000-0000000000b1';
const RETIRED_AT = new Date('2026-01-01T00:00:00.000Z');

/** The rows every case reads, identified by `email` so a leak names itself rather than moving a count. */
const SEED = [
	{ id: '5f000000-0000-4000-8000-000000000001', email: 'live@a', tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: null },
	{ id: '5f000000-0000-4000-8000-000000000002', email: 'retired@a', tenantId: TENANT_A, organizationId: ORGANIZATION_A, deletedAt: RETIRED_AT },
	{ id: '5f000000-0000-4000-8000-000000000003', email: 'retired@other-organization', tenantId: TENANT_A, organizationId: ORGANIZATION_B, deletedAt: RETIRED_AT },
	{ id: '5f000000-0000-4000-8000-000000000004', email: 'retired@other-tenant', tenantId: TENANT_B, organizationId: ORGANIZATION_A, deletedAt: RETIRED_AT }
].map((row, index) => ({
	...row,
	isActive: true,
	isArchived: false,
	createdAt: new Date(Date.UTC(2026, 0, 2 + index))
}));

const UserSchema = new EntitySchema({
	name: 'User',
	tableName: 'user',
	columns: {
		id: { primary: true, type: 'varchar' },
		email: { type: 'varchar', nullable: true },
		firstName: { type: 'varchar', nullable: true },
		lastName: { type: 'varchar', nullable: true },
		imageUrl: { type: 'varchar', nullable: true }
	}
});

const EmailTemplateSchema = new EntitySchema({
	name: 'EmailTemplate',
	tableName: 'email_template',
	columns: {
		id: { primary: true, type: 'varchar' },
		name: { type: 'varchar', nullable: true }
	}
});

// `EntitySchema<any>`: the generic infers its column names from `columns`, so a `relations` key it does
// not know is a compile error otherwise. `deleteDate` is what makes a TypeORM query builder add its own
// `deletedAt IS NULL` — the predicate `withDeleted` lifts.
const EmailHistorySchema = new EntitySchema<any>({
	name: 'EmailHistory',
	tableName: 'email_sent',
	columns: {
		id: { primary: true, type: 'varchar' },
		email: { type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		isActive: { type: 'boolean', default: true },
		isArchived: { type: 'boolean', default: false },
		createdAt: { type: 'datetime' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	},
	relations: {
		user: { type: 'many-to-one', target: 'User', joinColumn: { name: 'userId' }, nullable: true },
		emailTemplate: {
			type: 'many-to-one',
			target: 'EmailTemplate',
			joinColumn: { name: 'emailTemplateId' },
			nullable: true
		}
	}
});

/** The user the MikroORM read populates. */
@Entity({ tableName: 'user' })
class EmailHistoryWithDeletedUser {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string', nullable: true })
	email?: string | null;
}

/** The template the MikroORM read populates. */
@Entity({ tableName: 'email_template' })
class EmailHistoryWithDeletedTemplate {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string', nullable: true })
	name?: string | null;
}

/**
 * The ledger for MikroORM, soft-deletable the way `SoftDeletableBaseEntity` is: the decorator registers
 * the default-on filter a read has to disable by name.
 */
@SoftDeletable(() => EmailHistoryWithDeletedRow, 'deletedAt', () => new Date())
@Entity({ tableName: 'email_sent' })
class EmailHistoryWithDeletedRow {
	@PrimaryKey({ type: 'string' })
	id!: string;

	@Property({ type: 'string' })
	email!: string;

	@Property({ type: 'string', nullable: true })
	tenantId?: string | null;

	@Property({ type: 'string', nullable: true })
	organizationId?: string | null;

	@Property({ type: 'boolean' })
	isActive!: boolean;

	@Property({ type: 'boolean' })
	isArchived!: boolean;

	@Property({ type: 'datetime' })
	createdAt!: Date;

	@Property({ type: 'datetime', nullable: true })
	deletedAt?: Date | null;

	@ManyToOne(() => EmailHistoryWithDeletedUser, { nullable: true })
	user?: EmailHistoryWithDeletedUser | null;

	@ManyToOne(() => EmailHistoryWithDeletedTemplate, { nullable: true })
	emailTemplate?: EmailHistoryWithDeletedTemplate | null;
}

/** One ORM's database and the service reading it. */
interface IHarness {
	service(): EmailHistoryService;
	close(): Promise<void>;
}

async function typeOrmHarness(): Promise<IHarness> {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [UserSchema, EmailTemplateSchema, EmailHistorySchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
	});
	await dataSource.initialize();

	const ledger: Repository<any> = dataSource.getRepository('EmailHistory');
	await ledger.save(SEED);

	return {
		service: () => new EmailHistoryService(ledger as any, {} as any),
		close: () => dataSource.destroy()
	};
}

async function mikroOrmHarness(): Promise<IHarness> {
	const orm = await MikroORM.init({
		driver: BetterSqliteDriver,
		dbName: ':memory:',
		entities: [EmailHistoryWithDeletedUser, EmailHistoryWithDeletedTemplate, EmailHistoryWithDeletedRow],
		extensions: [SoftDeleteHandler],
		allowGlobalContext: true,
		discovery: { warnWhenNoEntities: false }
	});
	await orm.schema.createSchema();

	const em = orm.em.fork();
	await em.persistAndFlush(SEED.map((row) => em.create(EmailHistoryWithDeletedRow, row)));

	return {
		// A fresh fork per read, so a row is answered because the store answered it rather than because
		// the seeding context still held it.
		service: () =>
			new EmailHistoryService({} as any, orm.em.fork().getRepository(EmailHistoryWithDeletedRow) as any),
		close: () => orm.close(true)
	};
}

describe.each([
	[MultiORMEnum.TypeORM, typeOrmHarness],
	[MultiORMEnum.MikroORM, mikroOrmHarness]
])('EmailHistoryService.findAll honours withDeleted (%s)', (ormType, createHarness) => {
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

	/** The rows one read of the caller's organization answered, sorted. */
	const read = async (options: Record<string, unknown>): Promise<string[]> => {
		const { items, total } = await harness
			.service()
			.findAll({ where: { organizationId: ORGANIZATION_A }, ...options } as any);

		expect(total).toBe(items.length);
		return items.map((item: any) => item.email).sort();
	};

	it('answers the live rows of the caller organization without the flag', async () => {
		expect(await read({})).toEqual(['live@a']);
	});

	it('answers the retired rows too when the caller asks for them', async () => {
		// The failure scenario: this answered ['live@a'] — the flag was dropped on both ORMs.
		expect(await read({ withDeleted: true })).toEqual(['live@a', 'retired@a']);
	});

	it('never answers a retired row of another organization or another tenant', async () => {
		for (const withDeleted of [true, 'true']) {
			const answered = await read({ withDeleted });

			expect(answered).not.toContain('retired@other-organization');
			expect(answered).not.toContain('retired@other-tenant');
		}
	});

	it('reads the REST query string as a boolean, so "false" does not ask for retired rows', async () => {
		// The REST list route's pipe does not transform, so the flag arrives as text.
		expect(await read({ withDeleted: 'false' })).toEqual(['live@a']);
		expect(await read({ withDeleted: 'true' })).toEqual(['live@a', 'retired@a']);
	});
});
