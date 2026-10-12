import { ForbiddenException } from '@nestjs/common';
import { assertReferencesAreInScope } from './reference-scope.helper';

/**
 * The equipment-sharing update is a delete-then-recreate that spreads the request body, so a
 * body-supplied `equipmentId` / `equipmentSharingPolicyId` is persisted verbatim. Pinning the row's
 * own organizationId protects the ROW; it says nothing about what the row POINTS AT, and the foreign
 * key only proves the referenced row exists — not that it belongs to the caller's organization.
 */
describe('assertReferencesAreInScope', () => {
	const SCOPE = { tenantId: 'tenant-A', organizationId: 'org-1' };

	/** Records every lookup so the SCOPING itself can be asserted, not just the verdict. */
	const lookupReturning = (found: unknown) => {
		const calls: Array<{ table: string; where: Record<string, unknown> }> = [];
		const lookup = (table: string, where: Record<string, unknown>) => {
			calls.push({ table, where });
			return Promise.resolve(found);
		};
		return { lookup, calls };
	};

	it('skips entries with no id', async () => {
		const { lookup, calls } = lookupReturning(null);
		await expect(
			assertReferencesAreInScope([['equipment', undefined]], SCOPE, lookup)
		).resolves.toBeUndefined();
		expect(calls).toHaveLength(0);
	});

	it('accepts references that resolve inside the scope, and scopes BOTH columns', async () => {
		const { lookup, calls } = lookupReturning({ id: 'equipment-1' });
		await expect(
			assertReferencesAreInScope(
				[
					['equipment', 'equipment-1'],
					['equipment_sharing_policy', 'policy-1']
				],
				SCOPE,
				lookup
			)
		).resolves.toBeUndefined();

		expect(calls.map((c) => c.table)).toEqual(['equipment', 'equipment_sharing_policy']);
		for (const call of calls) {
			expect(call.where).toMatchObject({ tenantId: 'tenant-A', organizationId: 'org-1' });
		}
	});

	it('refuses a reference that does not resolve in the scope', async () => {
		const { lookup } = lookupReturning(null);
		await expect(
			assertReferencesAreInScope([['equipment', 'another-orgs-equipment']], SCOPE, lookup)
		).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('fails CLOSED with no tenant context, without even running the lookup', async () => {
		// An existence check that cannot be scoped proves nothing; answering "in scope" because there
		// is no scope to compare against is exactly how these guards rot.
		const { lookup, calls } = lookupReturning({ id: 'equipment-1' });
		await expect(
			assertReferencesAreInScope([['equipment', 'equipment-1']], { organizationId: 'org-1' }, lookup)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(calls).toHaveLength(0);
	});

	it('scopes by tenant alone when the record has no organization', async () => {
		const { lookup, calls } = lookupReturning({ id: 'equipment-1' });
		await assertReferencesAreInScope([['equipment', 'equipment-1']], { tenantId: 'tenant-A' }, lookup);
		expect(calls[0].where).toEqual({ id: 'equipment-1', tenantId: 'tenant-A' });
	});
});
