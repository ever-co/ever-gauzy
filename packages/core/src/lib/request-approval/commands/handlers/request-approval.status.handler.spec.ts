// Must stay first: loads the entity graph before the service and the controllers pull an entity.
import '../../../core/entities/internal';

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS_METADATA, ROLES_METADATA } from '@gauzy/constants';
import {
	ApprovalPolicyTypesStringEnum,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { CrudService } from '../../../core/crud/crud.service';
import { MultiORMEnum } from '../../../core/utils';
import { EquipmentSharingController } from '../../../equipment-sharing/equipment-sharing.controller';
import { TimeOffRequestController } from '../../../time-off-request/time-off-request.controller';
import { EQUIPMENT_SHARING_DECISION_GATE, TIME_OFF_DECISION_GATE } from '../../linked-document-decision.gate';
import { IRequestApprovalAnswerTransaction, RequestApprovalService } from '../../request-approval.service';
import { RequestApprovalStatusCommand } from '../request-approval.status.command';
import { RequestApprovalStatusHandler } from './request-approval.status.handler';

/**
 * F1 (privilege-escalation audit 2026-10-24, HIGH): `PUT /request-approval/approval/:id` and
 * `PUT /request-approval/refuse/:id` (GraphQL `approveRequestApproval` / `refuseRequestApproval`) dispatched this
 * command for any holder of `REQUEST_APPROVAL_EDIT` — a default EMPLOYEE grant. The handler set the request's
 * status through `updateStatusRequestApprovalByAdmin` (no approver check, no `min_count`, the conflict check
 * commented out) and then flipped the linked time-off request or equipment sharing, which their own routes only
 * let `@Roles(SUPER_ADMIN, ADMIN)` + `TIME_OFF_EDIT`, resp. `EQUIPMENT_APPROVE_REQUEST`, do. An employee approved a
 * colleague's leave, or their own equipment sharing.
 *
 * The real service and handler run over a fake of the answer's transaction: the writes it is handed are logged
 * when the body returns (the commit) and dropped when it throws (the rollback), so `calls` is what a store would
 * hold. The interleaving of two answers is covered in `request-approval.answer-atomic.spec.ts`.
 */

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORGANIZATION = 'organization-a';
const OTHER_ORGANIZATION = 'organization-b';
const FINANCE = 'team-finance';

interface IFixtureUser {
	id: string;
	employeeId: string | null;
	role: RolesEnum;
	permissions: PermissionsEnum[];
}

const MALLORY: IFixtureUser = {
	id: 'user-mallory',
	employeeId: 'employee-mallory',
	role: RolesEnum.EMPLOYEE,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT, PermissionsEnum.EQUIPMENT_MAKE_REQUEST]
};
const ALICE: IFixtureUser = {
	id: 'user-alice',
	employeeId: 'employee-alice',
	role: RolesEnum.EMPLOYEE,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT]
};
/** Alice again, as a manager the tenant let decide equipment sharings — and, by grant, time off. */
const ALICE_MANAGER: IFixtureUser = {
	...ALICE,
	role: RolesEnum.MANAGER,
	permissions: [
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.EQUIPMENT_APPROVE_REQUEST,
		PermissionsEnum.TIME_OFF_EDIT
	]
};
const ADMIN: IFixtureUser = {
	id: 'user-admin',
	employeeId: null,
	role: RolesEnum.ADMIN,
	permissions: [
		PermissionsEnum.REQUEST_APPROVAL_EDIT,
		PermissionsEnum.TIME_OFF_EDIT,
		PermissionsEnum.EQUIPMENT_APPROVE_REQUEST
	]
};
/** An administrator role the tenant took the time-off and equipment grants away from. */
const ADMIN_WITHOUT_DOCUMENT_GRANTS: IFixtureUser = { ...ADMIN, permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT] };

/** Active team memberships: Mallory is in Finance. */
const MEMBERSHIPS = [
	{ employeeId: MALLORY.employeeId, organizationTeamId: FINANCE, tenantId: TENANT, isActive: true },
	{ employeeId: ALICE.employeeId, organizationTeamId: FINANCE, tenantId: 'tenant-b', isActive: true }
];

function asUser(user: IFixtureUser) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: user.id,
		tenantId: TENANT,
		employeeId: user.employeeId,
		lastOrganizationId: ORGANIZATION,
		role: { name: user.role },
		permissions: user.permissions
	} as any);
}

function approvalRow(overrides: Record<string, any> = {}) {
	return {
		id: 'approval-1',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Request time off',
		status: REQUESTED,
		min_count: 1,
		createdByUserId: 'user-requester',
		requestType: ApprovalPolicyTypesStringEnum.TIME_OFF,
		requestId: 'time-off-1',
		employeeApprovals: [],
		teamApprovals: [],
		...overrides
	};
}

const equipmentRow = (overrides: Record<string, any> = {}) =>
	approvalRow({
		name: 'Laptop',
		requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
		requestId: 'sharing-1',
		...overrides
	});

const aliceSlot = () => ({ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED });

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function surfaces(row: Record<string, any>, stored: { request?: Record<string, any> } = {}) {
	const calls: string[] = [];
	const documents: Record<string, Record<string, any> | null> = {
		'time-off': { id: 'time-off-1', organizationId: ORGANIZATION, status: 'REQUESTED' },
		'equipment-sharing': { id: 'sharing-1', organizationId: ORGANIZATION, status: REQUESTED }
	};
	const slotWrites: { kind: string; ids: string[]; tenantId: string }[] = [];
	const locks: { id: string; tenantId: string }[] = [];

	const service = new RequestApprovalService(
		...(Array.from({ length: 8 }, () => ({})) as [any, any, any, any, any, any, any, any])
	);
	// The caller's scoped read: what decides whether the request is theirs to reach at all.
	jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => copy(row) as any);
	// Nothing of the answer may go through the service's own connection.
	const update = jest.spyOn(service, 'update');
	const save = jest.spyOn(service, 'save');

	jest.spyOn(service as any, 'answerTransaction').mockImplementation(async (work: any) => {
		// The rows as the locked read finds them: the stored request, by default the one the scoped read found.
		const locked = copy(stored.request ?? row);
		const pending: string[] = [];
		const transaction: IRequestApprovalAnswerTransaction = {
			lockRequest: async (id, tenantId) => {
				locks.push({ id, tenantId });
				const { employeeApprovals: _e, teamApprovals: _t, ...request } = locked;
				return id === locked.id && tenantId === locked.tenantId ? (request as any) : null;
			},
			readSlots: async () => ({
				employeeApprovals: copy(locked.employeeApprovals),
				teamApprovals: copy(locked.teamApprovals)
			}),
			readApproverTeams: async (employeeId, teamIds, tenantId) =>
				MEMBERSHIPS.filter(
					(membership) =>
						membership.employeeId === employeeId &&
						membership.tenantId === tenantId &&
						membership.isActive &&
						teamIds.includes(membership.organizationTeamId)
				).map((membership) => membership.organizationTeamId),
			writeSlots: async (kind, ids, tenantId, status) => {
				slotWrites.push({ kind, ids, tenantId });
				pending.push(`slot:${kind}:${status}`);
			},
			writeRequestStatus: async (_id, _tenantId, status) => {
				pending.push(`request:${status}`);
			},
			readLinkedDocument: async (kind, id) => {
				const document = documents[kind];
				return document?.id === id ? copy(document as any) : null;
			},
			moveTimeOff: async (id, _tenantId, status) => {
				if (documents['time-off']?.id !== id || documents['time-off'].status !== 'REQUESTED') {
					return 0;
				}
				pending.push(`time-off:${id}:${status}`);
				return 1;
			},
			moveEquipmentSharing: async (id, _tenantId, status) => {
				pending.push(`equipment:${id}:${status}`);
			}
		};
		// A body that throws commits nothing.
		const result = await work(transaction);
		calls.push(...pending);
		return result;
	});

	const handler = new RequestApprovalStatusHandler(service);
	const answer = (status: number) => handler.execute(new RequestApprovalStatusCommand(row.id, status));

	return { answer, calls, documents, slotWrites, locks, update, save };
}

describe('RequestApprovalStatusHandler (F1 — approve / refuse a request approval)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});
	afterEach(() => jest.restoreAllMocks());

	describe('an employee who is not an approver', () => {
		beforeEach(() => asUser(MALLORY));

		it.each([APPROVED, REFUSED])("cannot decide a colleague's leave (%p): 403, nothing written", async (status) => {
			const { answer, calls } = surfaces(approvalRow());

			await expect(answer(status)).rejects.toBeInstanceOf(ForbiddenException);
			expect(calls).toEqual([]);
		});

		it('cannot approve the equipment sharing they filed, even after listing themselves as its approver', async () => {
			const { answer, calls } = surfaces(
				equipmentRow({
					createdByUserId: MALLORY.id,
					employeeApprovals: [{ id: 'slot-mallory', employeeId: MALLORY.employeeId, status: REQUESTED }]
				})
			);

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
			expect(calls).toEqual([]);
		});
	});

	describe('a designated approver', () => {
		it('records an approval below min_count without moving the document', async () => {
			asUser(ALICE);
			const { answer, calls } = surfaces(equipmentRow({ min_count: 2, employeeApprovals: [aliceSlot()] }));

			const answered = await answer(APPROVED);

			expect(answered.status).toBe(REQUESTED);
			expect(calls).toEqual([`slot:employee:${APPROVED}`]);
		});

		it('moves the equipment sharing once min_count is reached, when they hold its decision permission', async () => {
			asUser(ALICE_MANAGER);
			const { answer, calls, slotWrites, locks, update, save } = surfaces(
				equipmentRow({ employeeApprovals: [aliceSlot()] })
			);

			const answered = await answer(APPROVED);

			expect(answered.status).toBe(APPROVED);
			// One commit: the document, the slot and the request together.
			expect(calls).toEqual([
				`equipment:sharing-1:${APPROVED}`,
				`slot:employee:${APPROVED}`,
				`request:${APPROVED}`
			]);
			// The request is read again under the lock, inside the caller's tenant, and the slot written by id there.
			expect(locks).toEqual([{ id: 'approval-1', tenantId: TENANT }]);
			expect(slotWrites).toEqual([{ kind: 'employee', ids: ['slot-alice'], tenantId: TENANT }]);
			// Nothing went through the service's own connection, outside the transaction.
			expect(update).not.toHaveBeenCalled();
			expect(save).not.toHaveBeenCalled();
		});

		it('is refused, before anything is written, when the answer would move an equipment sharing they may not decide', async () => {
			asUser(ALICE);
			const { answer, calls } = surfaces(equipmentRow({ employeeApprovals: [aliceSlot()] }));

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(answer(REFUSED)).rejects.toBeInstanceOf(ForbiddenException);
			expect(calls).toEqual([]);
		});

		it('does not move an equipment sharing of another organization: 404, nothing written', async () => {
			asUser(ALICE_MANAGER);
			const { answer, calls, documents } = surfaces(equipmentRow({ employeeApprovals: [aliceSlot()] }));
			documents['equipment-sharing'].organizationId = OTHER_ORGANIZATION;

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(NotFoundException);
			expect(calls).toEqual([]);
		});

		it('is refused on a time-off request without the time-off route role, even holding TIME_OFF_EDIT', async () => {
			asUser(ALICE_MANAGER);
			const { answer, calls } = surfaces(approvalRow({ employeeApprovals: [aliceSlot()] }));

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
			expect(calls).toEqual([]);
		});

		it('answers for an approver team they are an active member of, in their own tenant', async () => {
			asUser(MALLORY);
			const { answer, calls } = surfaces(
				approvalRow({
					name: 'Conference trip',
					requestType: ApprovalPolicyTypesStringEnum.BUSINESS_TRIP,
					requestId: null,
					teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: REQUESTED }]
				})
			);

			const answered = await answer(APPROVED);

			expect(answered.status).toBe(APPROVED);
			// A request that moves no document needs no document permission.
			expect(calls).toEqual([`slot:team:${APPROVED}`, `request:${APPROVED}`]);
		});

		it("does not answer for a team through another tenant's membership", async () => {
			asUser(ALICE);
			const { answer, calls } = surfaces(
				approvalRow({
					requestType: ApprovalPolicyTypesStringEnum.BUSINESS_TRIP,
					requestId: null,
					teamApprovals: [{ id: 'slot-finance', teamId: FINANCE, status: REQUESTED }]
				})
			);

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
			expect(calls).toEqual([]);
		});

		it.each([APPROVED, REFUSED])('gets a conflict on a request already decided (%p)', async (decided) => {
			asUser(ALICE_MANAGER);
			const { answer, calls } = surfaces(equipmentRow({ status: decided, employeeApprovals: [aliceSlot()] }));

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ConflictException);
			await expect(answer(REFUSED)).rejects.toBeInstanceOf(ConflictException);
			expect(calls).toEqual([]);
		});

		it.each([APPROVED, REFUSED])(
			'decides on the request the lock read, not on the earlier scoped read: decided meanwhile (%p) is a conflict',
			async (decided) => {
				asUser(ALICE_MANAGER);
				const open = equipmentRow({ employeeApprovals: [aliceSlot()] });
				const { answer, calls } = surfaces(open, {
					request: { ...open, status: decided, employeeApprovals: [aliceSlot()] }
				});

				await expect(answer(APPROVED)).rejects.toBeInstanceOf(ConflictException);
				expect(calls).toEqual([]);
			}
		);

		it('counts min_count on the slots the lock read: an approval committed meanwhile completes the request', async () => {
			asUser(ALICE_MANAGER);
			const bobSlot = { id: 'slot-bob', employeeId: 'employee-bob', status: REQUESTED };
			const open = equipmentRow({ min_count: 2, employeeApprovals: [aliceSlot(), bobSlot] });
			const { answer, calls } = surfaces(open, {
				request: { ...open, employeeApprovals: [aliceSlot(), { ...bobSlot, status: APPROVED }] }
			});

			const answered = await answer(APPROVED);

			expect(answered.status).toBe(APPROVED);
			expect(calls).toEqual([
				`equipment:sharing-1:${APPROVED}`,
				`slot:employee:${APPROVED}`,
				`request:${APPROVED}`
			]);
		});
	});

	describe('a tenant administrator', () => {
		it.each([
			[APPROVED, 'APPROVED'],
			[REFUSED, 'DENIED']
		])('decides a time-off request outright (%p) and the time-off moves to %p', async (status, timeOffStatus) => {
			asUser(ADMIN);
			const { answer, calls } = surfaces(approvalRow({ min_count: 3 }));

			const answered = await answer(status);

			expect(answered.status).toBe(status);
			expect(calls).toEqual([`time-off:time-off-1:${timeOffStatus}`, `request:${status}`]);
		});

		it('decides an approved equipment sharing the other way, and the sharing follows', async () => {
			asUser(ADMIN);
			const { answer, calls } = surfaces(equipmentRow({ status: APPROVED }));

			const answered = await answer(REFUSED);

			expect(answered.status).toBe(REFUSED);
			expect(calls).toEqual([`equipment:sharing-1:${REFUSED}`, `request:${REFUSED}`]);
		});

		it('cannot move a document their role no longer may decide', async () => {
			asUser(ADMIN_WITHOUT_DOCUMENT_GRANTS);

			for (const row of [approvalRow(), equipmentRow()]) {
				const { answer, calls } = surfaces(row);
				await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
				expect(calls).toEqual([]);
			}
		});

		it('writes the answer when the leave already carries the decision', async () => {
			asUser(ADMIN);
			const { answer, calls, documents } = surfaces(approvalRow());
			// The leave was decided through its own route: it is no longer REQUESTED, and says what this answer says.
			documents['time-off'].status = 'APPROVED';

			const answered = await answer(APPROVED);

			expect(answered.status).toBe(APPROVED);
			expect(calls).toEqual([`request:${APPROVED}`]);
		});

		it('refuses a leave decided the other way, and writes nothing', async () => {
			asUser(ADMIN);
			const { answer, calls, documents } = surfaces(approvalRow());
			documents['time-off'].status = 'DENIED';

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ConflictException);
			expect(calls).toEqual([]);
		});

		it('answers 404, and writes nothing, when the leave the request is about is gone', async () => {
			asUser(ADMIN);
			const { answer, calls, documents } = surfaces(approvalRow());
			documents['time-off'] = null;

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(NotFoundException);
			expect(calls).toEqual([]);
		});

		it('gets a conflict for the decision the request already carries', async () => {
			asUser(ADMIN);
			const { answer, calls } = surfaces(equipmentRow({ status: APPROVED }));

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ConflictException);
			expect(calls).toEqual([]);
		});
	});
});

describe('linked-document decision gates match the routes they stand for', () => {
	const metadata = (key: string, handler: Function) => Reflect.getMetadata(key, handler);

	it.each(['timeOffRequestApproved', 'timeOffRequestDenied'])(
		'TIME_OFF gate = TimeOffRequestController.%s',
		(name) => {
			const handler = (TimeOffRequestController.prototype as any)[name];

			expect(metadata(ROLES_METADATA, handler)).toEqual([...TIME_OFF_DECISION_GATE.roles]);
			expect(metadata(PERMISSIONS_METADATA, handler)).toEqual([...TIME_OFF_DECISION_GATE.permissions]);
		}
	);

	it.each(['equipmentSharingsRequestApproval', 'equipmentSharingsRequestRefuse'])(
		'EQUIPMENT_SHARING gate = EquipmentSharingController.%s',
		(name) => {
			const handler = (EquipmentSharingController.prototype as any)[name];

			expect(metadata(ROLES_METADATA, handler) ?? []).toEqual([...EQUIPMENT_SHARING_DECISION_GATE.roles]);
			expect(metadata(ROLES_METADATA, EquipmentSharingController)).toBeUndefined();
			expect(metadata(PERMISSIONS_METADATA, handler)).toEqual([...EQUIPMENT_SHARING_DECISION_GATE.permissions]);
		}
	);
});

describe('RequestApprovalService.updateStatusRequestApprovalByAdmin (the order package settling its open requests)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		asUser(ADMIN);
	});
	afterEach(() => jest.restoreAllMocks());

	/**
	 * @param scopedStatus The status the scoped read finds.
	 * @param lockedStatus The status the locked read finds, by default the same.
	 */
	function service(scopedStatus: number, lockedStatus: number = scopedStatus) {
		const instance = new RequestApprovalService(
			...(Array.from({ length: 6 }, () => ({})) as [any, any, any, any, any, any])
		);
		jest.spyOn(instance, 'findOneByIdString').mockResolvedValue(equipmentRow({ status: scopedStatus }) as any);
		const save = jest.spyOn(instance, 'save').mockImplementation(async (entity: any) => entity);
		const written: number[] = [];
		jest.spyOn(instance as any, 'answerTransaction').mockImplementation(async (work: any) => {
			const pending: number[] = [];
			const result = await work({
				lockRequest: async (id: string, tenantId: string) =>
					tenantId === TENANT ? equipmentRow({ id, status: lockedStatus }) : null,
				writeRequestStatus: async (_id: string, _tenantId: string, status: number) => {
					pending.push(status);
				}
			});
			written.push(...pending);
			return result;
		});
		return { instance, save, written };
	}

	it('decides an open request, on the transaction', async () => {
		const { instance, save, written } = service(REQUESTED);

		expect((await instance.updateStatusRequestApprovalByAdmin('approval-1', APPROVED)).status).toBe(APPROVED);
		expect(written).toEqual([APPROVED]);
		expect(save).not.toHaveBeenCalled();
	});

	it.each([APPROVED, REFUSED])(
		'restores the conflict check: a decided request (%p) is not decided again',
		async (decided) => {
			const { instance, written } = service(decided);

			await expect(instance.updateStatusRequestApprovalByAdmin('approval-1', REFUSED)).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(written).toEqual([]);
		}
	);

	it.each([APPROVED, REFUSED])(
		"checks on the locked read: an approver's answer (%p) committed after the scoped read is not overwritten",
		async (decided) => {
			const { instance, written } = service(REQUESTED, decided);

			await expect(instance.updateStatusRequestApprovalByAdmin('approval-1', APPROVED)).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(written).toEqual([]);
		}
	);
});
