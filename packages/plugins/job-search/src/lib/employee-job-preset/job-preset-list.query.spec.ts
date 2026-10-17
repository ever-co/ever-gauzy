import { knex, Knex } from 'knex';
import { jobPresetListQuery } from './job-preset-list.query';

/** The MikroORM job preset list, run on an in-memory SQLite database. */
describe('jobPresetListQuery', () => {
	let db: Knex;

	const names = async (filters: Partial<Parameters<typeof jobPresetListQuery>[1]> = {}) =>
		(await jobPresetListQuery(db, { tenantId: 'tenant-1', ...filters })).map(({ name }: { name: string }) => name);

	beforeAll(async () => {
		db = knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
		await db.schema.createTable('job_preset', (table) => {
			table.string('id').primary();
			table.string('tenantId');
			table.string('organizationId');
			table.string('name');
			table.datetime('deletedAt').nullable();
		});
		await db.schema.createTable('job_preset_employee', (table) => {
			table.string('jobPresetId');
			table.string('employeeId');
		});
		await db('job_preset').insert([
			{ id: 'p1', tenantId: 'tenant-1', organizationId: 'org-1', name: 'Angular jobs', deletedAt: null },
			{ id: 'p2', tenantId: 'tenant-1', organizationId: 'org-1', name: 'Node jobs', deletedAt: null },
			{ id: 'p3', tenantId: 'tenant-1', organizationId: 'org-1', name: 'Old jobs', deletedAt: '2026-10-01 00:00:00' },
			{ id: 'p4', tenantId: 'tenant-2', organizationId: 'org-2', name: 'Other tenant', deletedAt: null }
		]);
		await db('job_preset_employee').insert([{ jobPresetId: 'p2', employeeId: 'employee-1' }]);
	});

	afterAll(async () => {
		await db?.destroy();
	});

	it("lists the tenant's presets, without the soft-deleted one", async () => {
		expect(await names()).toEqual(['Angular jobs', 'Node jobs']);
	});

	it('searches the name case-insensitively (no ILIKE, which SQLite and MySQL reject)', async () => {
		expect(await names({ search: 'ANGULAR' })).toEqual(['Angular jobs']);
	});

	it("narrows the list to an employee's presets", async () => {
		expect(await names({ employeeId: 'employee-1' })).toEqual(['Node jobs']);
	});
});
