import { randomUUID } from 'node:crypto';
import { createAdapterForCurrentOrm, IOrmConformanceAdapter } from './orm-conformance.adapter';
import { getORMType } from '../../utils';

/**
 * TypeORM <-> MikroORM behavioral parity ("conformance") suite.
 *
 * `ormType` (see `getORMType()`) is read ONCE at module-import time by several core modules
 * (`crud.service.ts`, the per-property `MultiORM*` entity decorators, ...) and never re-evaluated,
 * so a single Jest process can only ever exercise ONE ORM's decorator metadata for a given entity
 * class — there is no supported way to flip between TypeORM and MikroORM mid-process for the same
 * class (see the harness README for the full explanation). This suite is therefore written ONCE
 * and run TWICE, as two separate process invocations with `DB_ORM` set differently, each asserting
 * the exact same documented behavior against a fresh in-memory SQLite database:
 *
 *   DB_ORM=typeorm    npx nx test core --testFile=orm-conformance.spec.ts --skip-nx-cache
 *   DB_ORM=mikro-orm  npx nx test core --testFile=orm-conformance.spec.ts --skip-nx-cache
 *
 * (`getORMType()` defaults to TypeORM when `DB_ORM` is unset, matching production.) Both invocations
 * must pass for the pair to be considered conformant — see `run-both-orms.sh` to run both at once.
 */
describe(`ORM conformance (DB_ORM=${getORMType()})`, () => {
	let adapter: IOrmConformanceAdapter;

	const TENANT_A = randomUUID();
	const TENANT_B = randomUUID();
	const ORG_A = randomUUID();

	beforeAll(async () => {
		adapter = await createAdapterForCurrentOrm();
	});

	afterAll(async () => {
		await adapter.close();
	});

	describe('tenant filtering', () => {
		it("never returns another tenant's rows from a tenant-scoped list", async () => {
			await adapter.seed([
				{ tenantId: TENANT_A, organizationId: ORG_A, name: 'a-own' },
				{ tenantId: TENANT_B, organizationId: ORG_A, name: 'b-foreign' }
			]);

			const rows = await adapter.findAllByTenant(TENANT_A);

			expect(rows.map((row) => row.name)).toEqual(['a-own']);
		});
	});

	describe('ordering', () => {
		it('orders ascending and descending identically to the requested direction', async () => {
			const tenantId = randomUUID();
			await adapter.seed([
				{ tenantId, organizationId: ORG_A, name: 'charlie', sortOrder: 3 },
				{ tenantId, organizationId: ORG_A, name: 'alpha', sortOrder: 1 },
				{ tenantId, organizationId: ORG_A, name: 'bravo', sortOrder: 2 }
			]);

			const ascending = await adapter.paginate({
				tenantId,
				skip: 0,
				take: 10,
				orderBy: 'sortOrder',
				direction: 'ASC'
			});
			const descending = await adapter.paginate({
				tenantId,
				skip: 0,
				take: 10,
				orderBy: 'sortOrder',
				direction: 'DESC'
			});

			expect(ascending.items.map((row) => row.name)).toEqual(['alpha', 'bravo', 'charlie']);
			expect(descending.items.map((row) => row.name)).toEqual(['charlie', 'bravo', 'alpha']);
		});
	});

	describe('pagination', () => {
		it('reports the full total while slicing only the requested page', async () => {
			const tenantId = randomUUID();
			await adapter.seed(
				Array.from({ length: 5 }, (_, index) => ({
					tenantId,
					organizationId: ORG_A,
					name: `item-${index}`,
					sortOrder: index
				}))
			);

			const page = await adapter.paginate({ tenantId, skip: 2, take: 2, orderBy: 'sortOrder', direction: 'ASC' });

			expect(page.total).toBe(5);
			expect(page.items.map((row) => row.name)).toEqual(['item-2', 'item-3']);
		});
	});

	describe('soft delete', () => {
		it('excludes a soft-deleted row by default, but surfaces it when explicitly requested', async () => {
			const tenantId = randomUUID();
			const [row] = await adapter.seed([{ tenantId, organizationId: ORG_A, name: 'to-delete' }]);

			await adapter.softDelete(row.id);

			const defaultList = await adapter.findAllByTenant(tenantId);
			const includingDeleted = await adapter.findIncludingDeleted(tenantId);

			expect(defaultList.map((r) => r.id)).not.toContain(row.id);
			expect(includingDeleted.map((r) => r.id)).toContain(row.id);
		});
	});
});
