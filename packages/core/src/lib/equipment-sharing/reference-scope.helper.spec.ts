import { ForbiddenException } from '@nestjs/common';
import {
	assertMembersAreInScope,
	assertReferencesAreInScope,
	sharingAsStored,
	sharingMemberReferences,
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
			values: { organizationId: 'org-B', equipmentId: 'equipment-b', equipmentSharingPolicyId: null },
			references: { equipmentId: 'equipment-b', equipmentSharingPolicyId: undefined },
			organizationId: 'org-B'
		});
	});

	it('stores a new row that names no organization in the caller’s, where it was checked', () => {
		expect(sharingAsStored({ equipmentId: 'equipment-a' }, null, 'org-A')).toEqual({
			values: { equipmentId: 'equipment-a', organizationId: 'org-A', equipmentSharingPolicyId: null },
			references: { equipmentId: 'equipment-a', equipmentSharingPolicyId: undefined },
			organizationId: 'org-A'
		});
	});

	it('checks an upsert in the stored row’s organization, and writes the organization and the policy it checked', () => {
		const stored = { organizationId: 'org-B', equipmentId: 'equipment-b', equipmentSharingPolicyId: 'policy-b' };

		expect(sharingAsStored({ id: 'sharing-1', equipmentId: 'equipment-a' } as any, stored, 'org-A')).toEqual({
			values: {
				id: 'sharing-1',
				organizationId: 'org-B',
				equipmentId: 'equipment-a',
				equipmentSharingPolicyId: 'policy-b'
			},
			references: { equipmentId: 'equipment-a', equipmentSharingPolicyId: 'policy-b' },
			organizationId: 'org-B'
		});
	});

	it('checks the references a stored row keeps in the organization an upsert moves it to', () => {
		const stored = { organizationId: 'org-B', equipmentId: 'equipment-b', equipmentSharingPolicyId: 'policy-b' };

		expect(sharingAsStored({ id: 'sharing-1', organizationId: 'org-A' } as any, stored, 'org-A')).toEqual({
			values: {
				id: 'sharing-1',
				organizationId: 'org-A',
				equipmentId: 'equipment-b',
				equipmentSharingPolicyId: 'policy-b'
			},
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

	it('holds the references of a row stored without an organization to the caller’s, and stores it there', () => {
		const stored = { organizationId: null, equipmentId: 'equipment-a', equipmentSharingPolicyId: null };

		const asStored = sharingAsStored({ id: 'sharing-1' } as any, stored, 'org-A');
		expect(asStored.organizationId).toBe('org-A');
		expect(asStored.values).toEqual({
			id: 'sharing-1',
			organizationId: 'org-A',
			equipmentId: 'equipment-a',
			equipmentSharingPolicyId: null
		});
	});

	it('writes the triple it checked, so an upsert keeps no reference a concurrent write stored meanwhile', () => {
		// Read before another upsert moved the sharing to org-B with org-B's equipment and policy.
		const read = { organizationId: 'org-A', equipmentId: 'equipment-a', equipmentSharingPolicyId: 'policy-a' };

		const asStored = sharingAsStored({ id: 'sharing-1', equipmentId: 'equipment-a2' } as any, read, 'org-A');

		expect(asStored.references).toEqual({ equipmentId: 'equipment-a2', equipmentSharingPolicyId: 'policy-a' });
		expect(asStored.organizationId).toBe('org-A');
		// Every column the check read is written: landing after the move, the write stores org-A's sharing whole,
		// never org-A's equipment in org-B's sharing.
		expect(asStored.values).toEqual({
			id: 'sharing-1',
			organizationId: 'org-A',
			equipmentId: 'equipment-a2',
			equipmentSharingPolicyId: 'policy-a'
		});
	});

	it('writes a reference the stored row and the body both leave absent as cleared, never as omitted', () => {
		const stored = { organizationId: 'org-A', equipmentId: 'equipment-a', equipmentSharingPolicyId: null };

		expect(sharingAsStored({ id: 'sharing-1' } as any, stored, 'org-A').values).toEqual({
			id: 'sharing-1',
			organizationId: 'org-A',
			equipmentId: 'equipment-a',
			equipmentSharingPolicyId: null
		});
	});
});

/**
 * The employees and the teams a sharing is handed to are many-to-many lists, which the CRUD base checked against the
 * tenant only: a body could list another organization's employees or teams of the same tenant (follow-up of
 * ever-co/ever-gauzy#11359). Each one is now held to the sharing's organization, like its equipment and its policy.
 */
describe('sharingMemberReferences', () => {
	it('lists the employees and the teams in both forms, the related object and the bare id', () => {
		expect(
			sharingMemberReferences({
				employees: [{ id: 'employee-1' }, 'employee-2'],
				teams: ['team-1', { id: 'team-2' }]
			})
		).toEqual([
			['employee', 'employee-1'],
			['employee', 'employee-2'],
			['organization_team', 'team-1'],
			['organization_team', 'team-2']
		]);
	});

	it('lists an id named twice only once', () => {
		expect(sharingMemberReferences({ employees: [{ id: 'employee-1' }, 'employee-1'] })).toEqual([
			['employee', 'employee-1']
		]);
	});

	it('lists nothing for absent, empty or cleared lists, and skips entries that name no id', () => {
		expect(sharingMemberReferences({})).toEqual([]);
		expect(sharingMemberReferences({ employees: [], teams: null })).toEqual([]);
		expect(sharingMemberReferences({ employees: [{}, { id: '' }, null, ''] })).toEqual([]);
	});

	it('reads a value that is not a list as a list of one, so it is checked too', () => {
		expect(sharingMemberReferences({ employees: { id: 'employee-1' }, teams: 'team-1' })).toEqual([
			['employee', 'employee-1'],
			['organization_team', 'team-1']
		]);
	});

	it('hands a non-string id on, so the scope check refuses it', () => {
		expect(sharingMemberReferences({ employees: [{ id: { $ne: null } }] })).toEqual([['employee', { $ne: null }]]);
	});
});

/**
 * A sharing may list many employees and teams, so their scope check reads each table once, with all of its ids,
 * instead of one query per member (review on ever-co/ever-gauzy#11397).
 */
describe('assertMembersAreInScope', () => {
	const SCOPE = { tenantId: 'tenant-A', organizationId: 'org-1' };
	const ROWS: Record<string, Array<{ id: string; tenantId: string; organizationId: string }>> = {
		employee: [
			{ id: 'employee-1', tenantId: 'tenant-A', organizationId: 'org-1' },
			{ id: 'employee-2', tenantId: 'tenant-A', organizationId: 'org-1' },
			{ id: 'employee-of-org-2', tenantId: 'tenant-A', organizationId: 'org-2' }
		],
		organization_team: [
			{ id: 'team-1', tenantId: 'tenant-A', organizationId: 'org-1' },
			{ id: 'team-of-org-2', tenantId: 'tenant-A', organizationId: 'org-2' }
		]
	};

	/** Answers the rows of a table whose id is listed and that match the scope; records every query. */
	const store = () => {
		const queries: Array<{ table: string; ids: string[]; scope: Record<string, unknown> }> = [];
		const lookupMany = jest.fn(async (table: string, ids: string[], scope: Record<string, unknown>) => {
			queries.push({ table, ids, scope });
			return (ROWS[table] ?? []).filter(
				(row) =>
					ids.includes(row.id) &&
					row.tenantId === scope['tenantId'] &&
					(scope['organizationId'] === undefined || row.organizationId === scope['organizationId'])
			);
		});
		return { lookupMany, queries };
	};

	it('reads each table once, with all of its ids, in the scope', async () => {
		const { lookupMany, queries } = store();

		await expect(
			assertMembersAreInScope(
				sharingMemberReferences({
					employees: [{ id: 'employee-1' }, 'employee-2', 'employee-1'],
					teams: [{ id: 'team-1' }]
				}),
				SCOPE,
				lookupMany
			)
		).resolves.toBeUndefined();

		expect(queries).toEqual([
			{ table: 'employee', ids: ['employee-1', 'employee-2'], scope: SCOPE },
			{ table: 'organization_team', ids: ['team-1'], scope: SCOPE }
		]);
	});

	it('refuses the list when one member is not found in the scope', async () => {
		for (const input of [
			{ employees: ['employee-1', 'employee-of-org-2'] },
			{ teams: [{ id: 'team-1' }, { id: 'team-of-org-2' }] },
			{ employees: ['no-such-employee'] }
		]) {
			const { lookupMany } = store();

			await expect(
				assertMembersAreInScope(sharingMemberReferences(input), SCOPE, lookupMany)
			).rejects.toBeInstanceOf(ForbiddenException);
		}
	});

	it('refuses a non-string id before any query, wherever it is listed', async () => {
		const { lookupMany } = store();

		await expect(
			assertMembersAreInScope(
				sharingMemberReferences({
					employees: ['employee-1'],
					teams: [{ id: 'team-1' }, { id: { $ne: null } }]
				}),
				SCOPE,
				lookupMany
			)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(lookupMany).not.toHaveBeenCalled();
	});

	it('runs no query for an empty list, and refuses a list without a tenant to scope by', async () => {
		const { lookupMany } = store();

		await expect(assertMembersAreInScope([], SCOPE, lookupMany)).resolves.toBeUndefined();
		await expect(
			assertMembersAreInScope([['employee', 'employee-1']], { organizationId: 'org-1' }, lookupMany)
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(lookupMany).not.toHaveBeenCalled();
	});

	it('scopes by the tenant alone when the sharing has no organization', async () => {
		const { lookupMany, queries } = store();

		await assertMembersAreInScope([['employee', 'employee-of-org-2']], { tenantId: 'tenant-A' }, lookupMany);

		expect(queries).toEqual([{ table: 'employee', ids: ['employee-of-org-2'], scope: { tenantId: 'tenant-A' } }]);
	});

	it('matches ids whatever their case', async () => {
		const lookupMany = jest.fn(async () => [{ id: 'employee-1' }]);

		await expect(
			assertMembersAreInScope([['employee', 'EMPLOYEE-1']], SCOPE, lookupMany)
		).resolves.toBeUndefined();
	});
});
