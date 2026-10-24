import { ForbiddenException } from '@nestjs/common';
import { assertReferencesAreInScope, sharingReferences, withReferencesAsIds } from './reference-scope.helper';

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

	it('refuses an id that is not a string, without handing it to the lookup as a criterion', async () => {
		const { lookup, calls } = lookupReturning({ id: 'equipment-1' });
		await expect(
			assertReferencesAreInScope([['equipment_sharing_policy', { $ne: null } as any]], SCOPE, lookup)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(calls).toHaveLength(0);
	});
});

/**
 * The body can name the policy (and the equipment) as the related object, `equipmentSharingPolicy: { id }`, which
 * the ORM persists as the foreign key just like the column. The check read the columns only, so a crafted body named
 * another organization's policy of the same tenant through the object (follow-up of ever-co/ever-gauzy#11167).
 */
describe('sharingReferences', () => {
	it('lists the related objects beside the columns', () => {
		expect(
			sharingReferences({
				equipmentId: 'equipment-1',
				equipment: { id: 'equipment-2' },
				equipmentSharingPolicyId: 'policy-1',
				equipmentSharingPolicy: { id: 'policy-2' }
			})
		).toEqual([
			['equipment', 'equipment-1'],
			['equipment', 'equipment-2'],
			['equipment_sharing_policy', 'policy-1'],
			['equipment_sharing_policy', 'policy-2']
		]);
	});

	it('reads a related object sent as a bare id string (MikroORM persists it as the foreign key)', () => {
		expect(sharingReferences({ equipmentSharingPolicy: 'policy-2' })).toContainEqual([
			'equipment_sharing_policy',
			'policy-2'
		]);
	});

	it('lists an id stated in both forms once', () => {
		expect(
			sharingReferences({ equipmentSharingPolicyId: 'policy-1', equipmentSharingPolicy: { id: 'policy-1' } })
		).toEqual([['equipment_sharing_policy', 'policy-1']]);
	});

	it('refuses an in-scope column beside a foreign related object', async () => {
		const lookup = async (_table: string, where: Record<string, unknown>) =>
			where['id'] === 'other-orgs-policy' ? null : { id: where['id'] };
		await expect(
			assertReferencesAreInScope(
				sharingReferences({
					equipmentSharingPolicyId: 'policy-1',
					equipmentSharingPolicy: { id: 'other-orgs-policy' }
				}),
				{ tenantId: 'tenant-A', organizationId: 'org-1' },
				lookup
			)
		).rejects.toBeInstanceOf(ForbiddenException);
	});
});

describe('withReferencesAsIds', () => {
	it('states each reference once, as its column, the related object winning', () => {
		const values = withReferencesAsIds({
			name: 'Laptop for a week',
			equipmentId: 'equipment-1',
			equipment: { id: 'equipment-2', autoApproveShare: true },
			equipmentSharingPolicyId: 'policy-1',
			equipmentSharingPolicy: { id: 'policy-2', name: 'Anything' }
		});

		expect(values).toEqual({
			name: 'Laptop for a week',
			equipmentId: 'equipment-2',
			equipmentSharingPolicyId: 'policy-2'
		});
		expect(values).not.toHaveProperty('equipment');
		expect(values).not.toHaveProperty('equipmentSharingPolicy');
	});

	it('keeps the columns when no related object names an id', () => {
		expect(
			withReferencesAsIds({ equipmentId: 'equipment-1', equipmentSharingPolicyId: 'policy-1', equipment: {} })
		).toEqual({ equipmentId: 'equipment-1', equipmentSharingPolicyId: 'policy-1' });
	});

	it('keeps an explicit null column (clearing the policy) and adds no column the body did not state', () => {
		expect(withReferencesAsIds({ equipmentSharingPolicyId: null })).toEqual({ equipmentSharingPolicyId: null });
		expect(withReferencesAsIds({ name: 'x' } as any)).toEqual({ name: 'x' });
	});
});
