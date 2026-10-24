import { ForbiddenException } from '@nestjs/common';
import {
	assertReferencesAreInScope,
	sharingAsStored,
	sharingReferences,
	withReferencesAsIds
} from './reference-scope.helper';

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

	/**
	 * `POST /equipment-sharing` upserts a row whose id the body carries: a cleared relation dropped as if omitted kept
	 * the stored policy attached instead of clearing it.
	 */
	it('keeps a relation the body clears as a cleared column, so an upsert still clears it', () => {
		expect(withReferencesAsIds({ id: 'sharing-1', equipmentSharingPolicy: null } as any)).toEqual({
			id: 'sharing-1',
			equipmentSharingPolicyId: null
		});
		expect(withReferencesAsIds({ equipmentSharingPolicy: { id: null } })).toEqual({
			equipmentSharingPolicyId: null
		});
	});

	it('keeps the column a body states beside a cleared relation', () => {
		expect(withReferencesAsIds({ equipmentSharingPolicyId: 'policy-1', equipmentSharingPolicy: null })).toEqual({
			equipmentSharingPolicyId: 'policy-1'
		});
	});

	it('folds the organization named as the related object into its column, the object winning', () => {
		expect(withReferencesAsIds({ organization: { id: 'org-B' } })).toEqual({ organizationId: 'org-B' });
		expect(withReferencesAsIds({ organizationId: 'org-A', organization: { id: 'org-B', name: 'B' } })).toEqual({
			organizationId: 'org-B'
		});
		expect(withReferencesAsIds({ organizationId: 'org-A' })).toEqual({ organizationId: 'org-A' });
	});
});

describe('sharingReferences — cleared relations', () => {
	it('lists no reference for a relation the body clears', () => {
		expect(sharingReferences({ equipmentSharingPolicy: null, equipment: { id: null } })).toEqual([]);
	});
});

/**
 * `POST /equipment-sharing` checked the references against the body's `organizationId`, else the caller's: a body
 * naming `organization: { id: 'org-B' }` was checked in the caller's organization but stored in B, and a body carrying
 * the id of a stored sharing (the CRUD base's `create()` upserts it) kept that row's organization and references
 * without the check reading either.
 */
describe('sharingAsStored', () => {
	it('checks a new row in the organization the body states, and stores it there', () => {
		const values = withReferencesAsIds({ organization: { id: 'org-B' }, equipmentId: 'equipment-b' });

		expect(sharingAsStored(values, null, 'org-A')).toEqual({
			values: { organizationId: 'org-B', equipmentId: 'equipment-b' },
			references: { equipmentId: 'equipment-b', equipmentSharingPolicyId: undefined },
			organizationId: 'org-B'
		});
	});

	it('stores a new row that names no organization in the caller’s, where it was checked', () => {
		expect(sharingAsStored({ equipmentId: 'equipment-a' }, null, 'org-A')).toEqual({
			values: { equipmentId: 'equipment-a', organizationId: 'org-A' },
			references: { equipmentId: 'equipment-a', equipmentSharingPolicyId: undefined },
			organizationId: 'org-A'
		});
	});

	it('checks an upsert in the stored row’s organization, which the write keeps', () => {
		const stored = { organizationId: 'org-B', equipmentId: 'equipment-b', equipmentSharingPolicyId: 'policy-b' };

		expect(sharingAsStored({ id: 'sharing-1', equipmentId: 'equipment-a' } as any, stored, 'org-A')).toEqual({
			values: { id: 'sharing-1', equipmentId: 'equipment-a' },
			references: { equipmentId: 'equipment-a', equipmentSharingPolicyId: 'policy-b' },
			organizationId: 'org-B'
		});
	});

	it('checks the references a stored row keeps in the organization an upsert moves it to', () => {
		const stored = { organizationId: 'org-B', equipmentId: 'equipment-b', equipmentSharingPolicyId: 'policy-b' };

		expect(sharingAsStored({ id: 'sharing-1', organizationId: 'org-A' } as any, stored, 'org-A')).toEqual({
			values: { id: 'sharing-1', organizationId: 'org-A' },
			references: { equipmentId: 'equipment-b', equipmentSharingPolicyId: 'policy-b' },
			organizationId: 'org-A'
		});
	});

	it('reads a reference an upsert clears as cleared, not as the stored one', () => {
		const stored = { organizationId: 'org-A', equipmentId: 'equipment-a', equipmentSharingPolicyId: 'policy-b' };

		expect(
			sharingAsStored({ id: 'sharing-1', equipmentSharingPolicyId: null } as any, stored, 'org-A').references
		).toEqual({ equipmentId: 'equipment-a', equipmentSharingPolicyId: null });
	});

	it('holds the references of a row stored without an organization to the caller’s, and does not move the row', () => {
		const stored = { organizationId: null, equipmentId: 'equipment-a', equipmentSharingPolicyId: null };

		const asStored = sharingAsStored({ id: 'sharing-1' } as any, stored, 'org-A');
		expect(asStored.organizationId).toBe('org-A');
		expect(asStored.values).toEqual({ id: 'sharing-1' });
	});
});
