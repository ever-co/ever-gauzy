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
import { getORMType } from '../../utils';

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
		await harness.close();
	});

	beforeEach(async () => {
		ownRow = await harness.seed({ tenantId: tenantA.tenantId, organizationId: tenantA.organizationId, name: 'own' });
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
