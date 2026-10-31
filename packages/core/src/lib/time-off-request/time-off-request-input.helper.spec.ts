import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum, StatusTypesEnum } from '@gauzy/contracts';
import {
	editChangesCharge,
	filedTimeOffStatus,
	requestedPolicyId,
	TIME_OFF_FOR_OTHERS_PERMISSIONS,
	timeOffEmployees,
	writableTimeOffMembers
} from './time-off-request-input.helper';

/**
 * F2 (privilege-escalation audit 2026-10-24): `POST /time-off-request` and `PUT /time-off-request/:id` stored the
 * body as given, with no whitelist DTO — `status: "APPROVED"` filed or edited leave as approved, and `employees`
 * filed it for any colleague. These are the rules the two writes now apply, on plain objects.
 */
describe('time-off request write whitelist (F2)', () => {
	const OWN = 'employee-own';
	const COLLEAGUE = 'employee-colleague';

	describe('filedTimeOffStatus', () => {
		it('files REQUESTED under a policy that requires approval, or none in scope', () => {
			expect(filedTimeOffStatus(true)).toBe(StatusTypesEnum.REQUESTED);
			expect(filedTimeOffStatus(undefined)).toBe(StatusTypesEnum.REQUESTED);
			expect(filedTimeOffStatus(null)).toBe(StatusTypesEnum.REQUESTED);
		});

		it('files APPROVED only under a stored policy that requires no approval', () => {
			expect(filedTimeOffStatus(false)).toBe(StatusTypesEnum.APPROVED);
		});
	});

	describe('writableTimeOffMembers', () => {
		const body = {
			id: 'someone-elses-request',
			tenantId: 'tenant-b',
			organizationId: 'organization-a',
			status: StatusTypesEnum.APPROVED,
			employees: [{ id: COLLEAGUE }],
			description: 'Holiday',
			start: '2026-11-02',
			end: '2026-11-06',
			requestDate: '2026-10-24',
			isHoliday: false,
			documentUrl: 'https://example.test/doc.pdf',
			documentId: 'document-1',
			policy: { id: 'policy-1', name: 'Paid leave', requiresApproval: false },
			isArchived: true,
			createdByUserId: 'user-x',
			fullName: 'Somebody'
		};

		it('never copies status, employees, id, tenant or audit members', () => {
			for (const create of [true, false]) {
				const members: Record<string, unknown> = writableTimeOffMembers(body, { create }) as any;

				for (const member of ['status', 'employees', 'id', 'tenantId', 'createdByUserId', 'fullName']) {
					expect(members).not.toHaveProperty(member);
				}
			}
		});

		it('copies the request members, the policy and the document as relations by id', () => {
			expect(writableTimeOffMembers(body, { create: true })).toEqual({
				description: 'Holiday',
				start: '2026-11-02',
				end: '2026-11-06',
				requestDate: '2026-10-24',
				isHoliday: false,
				documentUrl: 'https://example.test/doc.pdf',
				organizationId: 'organization-a',
				policy: { id: 'policy-1' },
				document: { id: 'document-1' }
			});
		});

		it('keeps the row organization on an edit, and the lifecycle flags the Archive action sends', () => {
			const members = writableTimeOffMembers(body, { create: false });

			expect(members).not.toHaveProperty('organizationId');
			expect(members.isArchived).toBe(true);
		});

		it('clears the document when the body clears it, and leaves it alone when the body is silent', () => {
			expect(writableTimeOffMembers({ documentId: null }, { create: false }).document).toBeNull();
			expect(writableTimeOffMembers({}, { create: false })).not.toHaveProperty('document');
		});

		it('reads the policy from policyId or from the policy object', () => {
			expect(requestedPolicyId({ policyId: 'policy-2' })).toBe('policy-2');
			expect(requestedPolicyId({ policy: { id: 'policy-3' } })).toBe('policy-3');
			expect(requestedPolicyId({})).toBeUndefined();
			expect(requestedPolicyId(null)).toBeUndefined();
		});
	});

	describe('timeOffEmployees', () => {
		const named = [{ id: COLLEAGUE }, { id: OWN }, { id: COLLEAGUE }, null, {}];

		it('lists the grants that let a caller name other employees', () => {
			expect([...TIME_OFF_FOR_OTHERS_PERMISSIONS]).toEqual([
				PermissionsEnum.CHANGE_SELECTED_EMPLOYEE,
				PermissionsEnum.ALL_ORG_EDIT
			]);
		});

		it('files a caller who may not act for others for themselves, whatever the body names', () => {
			expect(timeOffEmployees(named, { mayActForOthers: false, ownEmployeeId: OWN }, { create: true })).toEqual([
				{ id: OWN }
			]);
			expect(
				timeOffEmployees(undefined, { mayActForOthers: false, ownEmployeeId: OWN }, { create: true })
			).toEqual([{ id: OWN }]);
		});

		it('refuses a filing from a caller who may not act for others and is not an employee', () => {
			expect(() =>
				timeOffEmployees(named, { mayActForOthers: false, ownEmployeeId: null }, { create: true })
			).toThrow(ForbiddenException);
		});

		it('keeps the stored employees on an edit by a caller who may not act for others', () => {
			expect(
				timeOffEmployees(named, { mayActForOthers: false, ownEmployeeId: OWN }, { create: false })
			).toBeUndefined();
		});

		it('files the employees an administrator names, as ids, once each', () => {
			const caller = { mayActForOthers: true, ownEmployeeId: null };

			expect(timeOffEmployees(named, caller, { create: true })).toEqual([{ id: COLLEAGUE }, { id: OWN }]);
			expect(timeOffEmployees(named, caller, { create: false })).toEqual([{ id: COLLEAGUE }, { id: OWN }]);
			// An edit that does not mention them leaves them as stored.
			expect(timeOffEmployees(undefined, caller, { create: false })).toBeUndefined();
		});
	});
});

/**
 * Whether an edit of an approved request moves what its approval took from leave balances (ever-co/ever-gauzy#10183,
 * #11601 review): its dates, its holiday flag, its policy or its employees, compared with the stored request, since
 * the request dialog sends every member on each edit.
 */
describe('editChangesCharge', () => {
	const POLICY = '0f7c1a2e-0000-4000-8000-00000000e001';
	const stored = {
		start: new Date('2026-11-01T23:00:00.000Z'),
		end: new Date('2026-11-07T23:00:00.000Z'),
		isHoliday: false,
		policy: { id: POLICY },
		policyId: POLICY,
		employees: [{ id: 'employee-a' }, { id: 'employee-b' }]
	};

	it('is false for an edit that writes none of them (description, document, archiving)', () => {
		expect(editChangesCharge(stored, { description: 'reworded', isArchived: true }, undefined)).toBe(false);
	});

	it('is false for the stored values sent back, in another shape', () => {
		expect(
			editChangesCharge(
				stored,
				{
					start: '2026-11-01T23:00:00.000Z',
					end: stored.end,
					isHoliday: false,
					policy: { id: POLICY.toUpperCase() }
				},
				[{ id: 'EMPLOYEE-B' }, { id: 'employee-a' }]
			)
		).toBe(false);
	});

	it.each([
		['a start', { start: '2026-11-02T23:00:00.000Z' }],
		['an end', { end: new Date('2026-11-12T23:00:00.000Z') }],
		['the holiday flag', { isHoliday: true }],
		['the policy', { policy: { id: '0f7c1a2e-0000-4000-8000-00000000e002' } }]
	])('is true for an edit that moves %s', (_, members) => {
		expect(editChangesCharge(stored, members, undefined)).toBe(true);
	});

	it('is true for an edit that adds or removes an employee', () => {
		expect(editChangesCharge(stored, {}, [{ id: 'employee-a' }])).toBe(true);
		expect(editChangesCharge(stored, {}, [{ id: 'employee-a' }, { id: 'employee-b' }, { id: 'employee-c' }])).toBe(
			true
		);
	});

	it('reads the stored policy from its id when the relation was not loaded', () => {
		const { policy, ...withoutRelation } = stored;
		expect(editChangesCharge(withoutRelation, { policy: { id: policy.id } }, undefined)).toBe(false);
	});
});
