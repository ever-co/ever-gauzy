import '../../entities/internal';

import { createPersistenceInvariantHarness, IPersistenceInvariantHarness } from './persistence-invariant.adapter';
import { asTenantUser, createCrossTenantFixture } from '../tenant-isolation/tenant-isolation.fixtures';
import {
	assertCanReadOwnTenant,
	assertCannotClaimForeignRowOnWrite,
	assertCannotDeleteAcrossTenant,
	assertCannotReadAcrossTenant,
	assertCannotUpdateAcrossTenant,
	assertListExcludesOtherTenant
} from '../tenant-isolation/tenant-isolation.assertions';
import { getORMType, MultiORMEnum } from '../../utils';

/**
 * TASK 3: the unified persistence-invariant framework — TASK 1's tenant-isolation invariants
 * (`assertCannot*AcrossTenant`, unchanged, imported straight from `../tenant-isolation`), now
 * proven against a REAL database under EITHER ORM (TASK 2's dual-ORM-process approach), instead of
 * against TASK 1's in-memory fake repository. Same invariants, same assertion functions, executed
 * against every supported ORM — exactly the roadmap's "Combined Tenant Isolation + ORM Conformance
 * Framework" diagram.
 *
 * Like `orm-conformance.spec.ts`, this file is written once and run as two separate process
 * invocations (see this folder's README / `run-both-orms.sh`), because `DB_ORM` is fixed at
 * module-import time for the whole process.
 */
describe(`Persistence invariants (DB_ORM=${getORMType()})`, () => {
	const { tenantA, tenantB } = createCrossTenantFixture();

	let harness: IPersistenceInvariantHarness;
	let ownRow: { id: string };
	let foreignRow: { id: string };
	let restore: () => void = () => undefined;

	beforeAll(async () => {
		harness = await createPersistenceInvariantHarness();
	});

	afterAll(async () => {
		// Optional chaining, not a bare `harness.close()`: if `beforeAll` itself threw (e.g. the test
		// database failed to come up), `harness` is still `undefined` here, and Jest still runs
		// `afterAll` — a bare call would throw `Cannot read properties of undefined`, masking the
		// real `beforeAll` failure behind a confusing secondary one (a real review finding on this PR).
		await harness?.close();
	});

	beforeEach(async () => {
		// The database lives for the whole file (`beforeAll`), so without this every test would also see
		// every earlier test's rows. With exactly one own and one foreign row per test, no assertion can
		// pass just because the row it checks for fell outside a result page.
		await harness.clear();
		ownRow = await harness.seed({
			tenantId: tenantA.tenantId,
			organizationId: tenantA.organizationId,
			name: 'own'
		});
		foreignRow = await harness.seed({
			tenantId: tenantB.tenantId,
			organizationId: tenantB.organizationId,
			name: 'foreign'
		});
		({ restore } = asTenantUser(tenantA));
	});

	afterEach(() => restore());

	it('can read its own tenant row against the real database (positive control)', async () => {
		await assertCanReadOwnTenant(harness.service, ownRow.id);
	});

	// Positive controls for the write paths. Without them, an update, delete or save() that failed for
	// every caller would satisfy the matching "cannot" test below just as well as a correct one.
	it('can update its own tenant row against the real database (positive control)', async () => {
		await harness.service.update(ownRow.id, { name: 'renamed' });
		await expect(harness.service.findOneByIdString(ownRow.id)).resolves.toMatchObject({ name: 'renamed' });
	});

	it('can delete its own tenant row against the real database (positive control)', async () => {
		const result = await harness.service.delete(ownRow.id);
		expect(result.affected).toBe(1);
		expect(await harness.exists(ownRow.id)).toBe(false);
	});

	// Under MikroORM, save() rejects the caller's OWN existing row as well (the same code as on develop):
	// `assertNotForeignRow` loads it with `fields: ['id', 'tenantId']`, which does not hydrate the
	// `persist: false` `tenantId` mirror, so the guard fails closed with "belongs to another tenant",
	// the very error the "cannot claim" test below expects. `it.failing` records that instead of letting
	// the MikroORM run pass as proof, and turns red once save() works for the caller's own tenant there.
	const itExceptMikroOrm = getORMType() === MultiORMEnum.MikroORM ? it.failing : it;

	itExceptMikroOrm('can save() its own tenant row against the real database (positive control)', async () => {
		await harness.service.save({ id: ownRow.id, name: 'resaved' });
		await expect(harness.service.findOneByIdString(ownRow.id)).resolves.toMatchObject({ name: 'resaved' });
	});

	it('cannot read another tenant row against the real database', async () => {
		await assertCannotReadAcrossTenant(harness.service, foreignRow.id);
	});

	it('cannot update another tenant row against the real database', async () => {
		await assertCannotUpdateAcrossTenant(harness.service, foreignRow.id, { name: 'renamed' });
	});

	it('cannot delete another tenant row against the real database', async () => {
		await assertCannotDeleteAcrossTenant(harness.service, foreignRow.id, () => harness.exists(foreignRow.id));
	});

	it('cannot claim another tenant row via save() against the real database', async () => {
		await assertCannotClaimForeignRowOnWrite(harness.service, foreignRow.id);
	});

	it('list operations never surface another tenant row from the real database', async () => {
		await assertListExcludesOtherTenant(harness.service, foreignRow.id);
	});
});
