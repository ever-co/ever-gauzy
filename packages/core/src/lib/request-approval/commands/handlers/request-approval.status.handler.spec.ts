// Must stay first: loads the entity graph before the service and the controllers pull an entity.
import '../../../core/entities/internal';

import { ConflictException, ForbiddenException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
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
import { RequestApprovalService } from '../../request-approval.service';
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
 * The real service runs over fake repositories; the two document services are fakes that log their calls.
 */

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORGANIZATION = 'organization-a';
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

function surfaces(row: Record<string, any>) {
	const calls: string[] = [];
	const manager = {
		update: jest.fn(async (entity: { name: string }, _where: any, patch: any) => {
			calls.push(`slot:${entity.name}:${patch.status}`);
			return { affected: 1 };
		})
	};
	const teamMemberships = {
		find: jest.fn(async ({ where }: any) =>
			MEMBERSHIPS.filter(
				(membership) =>
					membership.employeeId === where.employeeId &&
					membership.tenantId === where.tenantId &&
					membership.isActive === where.isActive &&
					((where.organizationTeamId as FindOperator<string[]>).value as unknown as string[]).includes(
						membership.organizationTeamId
					)
			)
		)
	};
	const service = new RequestApprovalService(
		{ manager } as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		{} as any,
		teamMemberships as any,
		{} as any
	);
	// A fresh copy per read, as the store answers one: an answer applies itself to the row it read.
	jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => JSON.parse(JSON.stringify(row)));
	const update = jest.spyOn(service, 'update').mockImplementation(async (_id: any, patch: any) => {
		calls.push(`request:${patch.status}`);
		return { affected: 1 } as any;
	});
	const timeOffRequestService = {
		updateStatusTimeOffByAdmin: jest.fn(async (id: string, status: string) => {
			calls.push(`time-off:${id}:${status}`);
		})
	};
	const equipmentSharingService = {
		updateStatusEquipmentSharingByAdmin: jest.fn(async (id: string, status: number) => {
			calls.push(`equipment:${id}:${status}`);
		})
	};
	const handler = new RequestApprovalStatusHandler(
		service,
		equipmentSharingService as any,
		timeOffRequestService as any
	);
	const answer = (status: number) => handler.execute(new RequestApprovalStatusCommand(row.id, status));

	return { answer, calls, manager, update, teamMemberships, timeOffRequestService, equipmentSharingService };
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
			const { answer, calls, update } = surfaces(
				equipmentRow({ min_count: 2, employeeApprovals: [aliceSlot()] })
			);

			const answered = await answer(APPROVED);

			expect(answered.status).toBe(REQUESTED);
			expect(calls).toEqual([`slot:RequestApprovalEmployee:${APPROVED}`]);
			expect(update).not.toHaveBeenCalled();
		});

		it('moves the equipment sharing once min_count is reached, when they hold its decision permission', async () => {
			asUser(ALICE_MANAGER);
			const { answer, calls, manager } = surfaces(equipmentRow({ employeeApprovals: [aliceSlot()] }));

			const answered = await answer(APPROVED);

			expect(answered.status).toBe(APPROVED);
			// The document first, so a refusal from its own service leaves the request untouched; then the answer.
			expect(calls).toEqual([
				`equipment:sharing-1:${APPROVED}`,
				`slot:RequestApprovalEmployee:${APPROVED}`,
				`request:${APPROVED}`
			]);
			// The slot is written by id inside the caller's tenant.
			const [, where] = manager.update.mock.calls[0];
			expect(where.tenantId).toBe(TENANT);
			expect((where.id as FindOperator<string[]>).value).toEqual(['slot-alice']);
		});

		it('is refused, before anything is written, when the answer would move an equipment sharing they may not decide', async () => {
			asUser(ALICE);
			const { answer, calls } = surfaces(equipmentRow({ employeeApprovals: [aliceSlot()] }));

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
			await expect(answer(REFUSED)).rejects.toBeInstanceOf(ForbiddenException);
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
			const { answer, calls, teamMemberships } = surfaces(
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
			expect(calls).toEqual([`slot:RequestApprovalTeam:${APPROVED}`, `request:${APPROVED}`]);
			expect(teamMemberships.find).toHaveBeenCalledWith({
				where: expect.objectContaining({ employeeId: MALLORY.employeeId, tenantId: TENANT, isActive: true })
			});
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

		it('cannot move a document their role no longer may decide', async () => {
			asUser(ADMIN_WITHOUT_DOCUMENT_GRANTS);

			for (const row of [approvalRow(), equipmentRow()]) {
				const { answer, calls } = surfaces(row);
				await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
				expect(calls).toEqual([]);
			}
		});

		it("leaves the request untouched when the document's own service refuses the change", async () => {
			asUser(ADMIN);
			const { answer, calls, timeOffRequestService } = surfaces(approvalRow());
			timeOffRequestService.updateStatusTimeOffByAdmin.mockRejectedValueOnce(
				new ConflictException('Request time off is Conflict')
			);

			await expect(answer(APPROVED)).rejects.toBeInstanceOf(ConflictException);
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

	function service(status: number) {
		const instance = new RequestApprovalService(
			...(Array.from({ length: 6 }, () => ({})) as [any, any, any, any, any, any])
		);
		jest.spyOn(instance, 'findOneByIdString').mockResolvedValue(equipmentRow({ status }) as any);
		const save = jest.spyOn(instance, 'save').mockImplementation(async (entity: any) => entity);
		return { instance, save };
	}

	it('decides an open request', async () => {
		const { instance, save } = service(REQUESTED);

		expect((await instance.updateStatusRequestApprovalByAdmin('approval-1', APPROVED)).status).toBe(APPROVED);
		expect(save).toHaveBeenCalled();
	});

	it.each([APPROVED, REFUSED])(
		'restores the conflict check: a decided request (%p) is not decided again',
		async (decided) => {
			const { instance, save } = service(decided);

			await expect(instance.updateStatusRequestApprovalByAdmin('approval-1', REFUSED)).rejects.toBeInstanceOf(
				ConflictException
			);
			expect(save).not.toHaveBeenCalled();
		}
	);
});
