import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { assertPlainReferencesNotForeign, PlainReferenceColumns } from './plain-reference-ownership.helper';

/**
 * A plain id column — an id of another row with no relation declared — may not name another tenant's row
 * (security audit P0 #6c). The relation check (`assertGraphNotForeign`, SEC-D-03) reads relation metadata, so it
 * never saw these columns; this is the same rule stated for them.
 *
 * A real SQLite database: a target table holding one row of tenant A, one of tenant B (and a retired one of B), one of
 * no tenant; the helper is asked about payloads naming each.
 */

const TENANT_A = 'a6c00000-0000-4000-8000-00000000000a';
const TENANT_B = 'a6c00000-0000-4000-8000-00000000000b';

const ROW = {
	a: 'a6c00000-0000-4000-8000-0000000001a1',
	b: 'a6c00000-0000-4000-8000-0000000001b1',
	retiredB: 'a6c00000-0000-4000-8000-0000000001b2',
	global: 'a6c00000-0000-4000-8000-0000000001c1',
	missing: 'a6c00000-0000-4000-8000-0000000001ff'
};

const TargetSchema = new EntitySchema<any>({
	name: 'PlainTarget',
	tableName: 'plain_target',
	columns: {
		id: { primary: true, type: 'varchar' },
		tenantId: { type: 'varchar', nullable: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	}
});

/** A table with no tenant column: nothing in it belongs to a tenant, so nothing is compared. */
const UnscopedSchema = new EntitySchema<any>({
	name: 'PlainUnscoped',
	tableName: 'plain_unscoped',
	columns: { id: { primary: true, type: 'varchar' } }
});

const REFERENCES: PlainReferenceColumns = {
	targetId: 'plain_target',
	unscopedId: 'plain_unscoped',
	uninstalledId: 'table_of_a_package_not_installed'
};

describe('assertPlainReferencesNotForeign — a plain id column may not name another tenant’s row (P0 #6c)', () => {
	let dataSource: DataSource;
	const check = (payloads: unknown, tenantId: string | null = TENANT_A) =>
		assertPlainReferencesNotForeign(dataSource.manager, payloads, REFERENCES, tenantId);

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [TargetSchema, UnscopedSchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		await dataSource.getRepository('PlainTarget').insert([
			{ id: ROW.a, tenantId: TENANT_A },
			{ id: ROW.b, tenantId: TENANT_B },
			{ id: ROW.retiredB, tenantId: TENANT_B, deletedAt: new Date() },
			{ id: ROW.global, tenantId: null }
		]);
		await dataSource.getRepository('PlainUnscoped').insert([{ id: ROW.b }]);
	});

	afterAll(async () => {
		if (dataSource?.isInitialized) await dataSource.destroy();
	});

	it('refuses an id naming another tenant’s row', async () => {
		await expect(check({ targetId: ROW.b })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses another tenant’s retired row too', async () => {
		await expect(check({ targetId: ROW.retiredB })).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses a batch when any one of its rows names another tenant’s row', async () => {
		await expect(
			check([{ targetId: ROW.a }, { targetId: ROW.b }, { targetId: ROW.global }])
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('lets the caller’s own row, a row of no tenant, an id naming no row and an absent id through', async () => {
		await expect(
			check([
				{ targetId: ROW.a },
				{ targetId: ROW.global },
				{ targetId: ROW.missing },
				{ targetId: null },
				{ targetId: '' },
				{}
			])
		).resolves.toBeUndefined();
	});

	it('compares the stored tenant case-insensitively, as the relation check does', async () => {
		await expect(check({ targetId: ROW.a }, TENANT_A.toUpperCase())).resolves.toBeUndefined();
	});

	it('refuses a reference that is not an id at all', async () => {
		await expect(check({ targetId: { id: ROW.a } })).rejects.toBeInstanceOf(BadRequestException);
		await expect(check({ targetId: 7 })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('does not compare a table without a tenant column, or a table no installed package maps', async () => {
		await expect(check({ unscopedId: ROW.b, uninstalledId: ROW.b })).resolves.toBeUndefined();
	});

	it('holds a caller with no tenant — a job, a seeder — to nothing', async () => {
		await expect(check({ targetId: ROW.b }, null)).resolves.toBeUndefined();
	});

	it('reads nothing for an empty payload', async () => {
		await expect(check(undefined)).resolves.toBeUndefined();
		await expect(check([])).resolves.toBeUndefined();
	});
});
