// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import {
	ApprovalPolicyTypesStringEnum,
	PermissionsEnum,
	RequestApprovalStatusTypesEnum,
	RolesEnum
} from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { EquipmentSharing, RequestApprovalEmployee, RequestApprovalTeam } from '../core/entities/internal';
import { MultiORMEnum } from '../core/utils';
import { RequestApproval } from './request-approval.entity';
import { IRequestApprovalRequestedFor } from './request-approval-decision';
import {
	IRequestApprovalAnswerTransaction,
	RequestApprovalLinkedDocumentKind,
	requestersOfDocument,
	RequestApprovalService
} from './request-approval.service';

/**
 * Owner decision Q9 (2026-10-24), as `RequestApprovalService.answer` applies it: one person counts once toward
 * `min_count`, and nobody approves a request they raised or that is for them through any slot.
 *
 * Before: an approver who held their own employee slot and was a member of an approver team filled both slots with
 * one answer, so a request needing two approvals was approved by one person; and the request's own `createdByUserId`
 * was the only requester known — the user who filed the time-off request or the equipment sharing a request is
 * about (an edit of a sharing files its request approval again, under the editor), and the employees it is for,
 * could approve it through an approver team they belong to.
 *
 * The real service runs over a fake of the answer's transaction; the last blocks pin the statements each ORM arm sends.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORGANIZATION = 'organization-a';
const FINANCE = 'team-finance';
/** The documents a request is about are named by their uuid. */
const SHARING_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const TIME_OFF_ID = '9b2e4b0a-1c1e-4f7a-8d55-3f0c6f1d2a10';

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
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT]
};
const ALICE: IFixtureUser = {
	id: 'user-alice',
	employeeId: 'employee-alice',
	role: RolesEnum.EMPLOYEE,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT]
};
const BOB: IFixtureUser = { ...ALICE, id: 'user-bob', employeeId: 'employee-bob' };
const ADMIN: IFixtureUser = {
	id: 'user-admin',
	employeeId: null,
	role: RolesEnum.ADMIN,
	permissions: [PermissionsEnum.REQUEST_APPROVAL_EDIT]
};

/** The approver teams each employee is an active member of. */
const MEMBERSHIPS: Record<string, string[]> = {
	'employee-mallory': [FINANCE],
	'employee-alice': [FINANCE]
};

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

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const aliceSlot = () => ({ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED });
const bobSlot = () => ({ id: 'slot-bob', employeeId: BOB.employeeId, status: REQUESTED });
const financeSlot = () => ({ id: 'slot-finance', teamId: FINANCE, status: REQUESTED });

/** A request about no document (a business trip), with Alice's own slot and the finance team's slot. */
function approvalRow(overrides: Record<string, any> = {}) {
	return {
		id: 'approval-1',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		name: 'Conference trip',
		status: REQUESTED,
		min_count: 2,
		createdByUserId: 'user-requester',
		requestType: ApprovalPolicyTypesStringEnum.BUSINESS_TRIP,
		requestId: null,
		employeeApprovals: [aliceSlot()],
		teamApprovals: [financeSlot()],
		...overrides
	};
}

/** The answer over a fake transaction: the slot writes it hands over, and the document reads it makes. */
function answering(row: Record<string, any>, requestedFor: IRequestApprovalRequestedFor | null = null) {
	const slotWrites: { kind: string; ids: string[]; status: number; answeredByUserId: string | null | undefined }[] =
		[];
	const requesterReads: [RequestApprovalLinkedDocumentKind, string, string][] = [];

	const service = new RequestApprovalService(
		...(Array.from({ length: 8 }, () => ({})) as [any, any, any, any, any, any, any, any])
	);
	jest.spyOn(service, 'findOneByIdString').mockImplementation(async () => copy(row) as any);
	jest.spyOn(service as any, 'answerTransaction').mockImplementation(async (work: any) => {
		const locked = copy(row);
		const transaction: IRequestApprovalAnswerTransaction = {
			lockRequest: async (id, tenantId) => {
				const { employeeApprovals: _e, teamApprovals: _t, ...request } = locked;
				return id === locked.id && tenantId === locked.tenantId ? (request as any) : null;
			},
			readSlots: async () => ({
				employeeApprovals: copy(locked.employeeApprovals),
				teamApprovals: copy(locked.teamApprovals)
			}),
			readApproverTeams: async (employeeId, teamIds) =>
				(MEMBERSHIPS[employeeId] ?? []).filter((teamId) => teamIds.includes(teamId)),
			readLinkedDocumentRequesters: async (kind, id, tenantId) => {
				requesterReads.push([kind, id, tenantId]);
				return requestedFor ?? { userIds: [], employeeIds: [] };
			},
			writeSlots: async (kind, ids, _tenantId, status, answeredByUserId) => {
				slotWrites.push({ kind, ids, status, answeredByUserId });
			},
			writeRequestStatus: async () => undefined,
			readLinkedDocument: async () => null,
			moveTimeOff: async () => 0,
			moveEquipmentSharing: async () => undefined
		};
		return await work(transaction);
	});

	const answer = (status: number) => service.answer(row.id, status as any);
	return { answer, slotWrites, requesterReads };
}

describe('RequestApprovalService.answer — one person counts once toward min_count', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});
	afterEach(() => jest.restoreAllMocks());

	it('records an approver holding their own slot and a team slot on both, stamped, and counts them once', async () => {
		asUser(ALICE);
		const { answer, slotWrites } = answering(approvalRow());

		const answered = await answer(APPROVED);

		// Before: both slots counted, and the request needing two approvals was approved by Alice alone.
		expect(answered.status).toBe(REQUESTED);
		expect(slotWrites).toEqual([
			{ kind: 'employee', ids: ['slot-alice'], status: APPROVED, answeredByUserId: ALICE.id },
			{ kind: 'team', ids: ['slot-finance'], status: APPROVED, answeredByUserId: ALICE.id }
		]);
	});

	it('approves the request once a second person approves', async () => {
		asUser(BOB);
		const { answer, slotWrites } = answering(
			approvalRow({
				employeeApprovals: [
					{ ...aliceSlot(), status: APPROVED, updatedByUserId: ALICE.id },
					bobSlot()
				],
				teamApprovals: [{ ...financeSlot(), status: APPROVED, updatedByUserId: ALICE.id }]
			})
		);

		const answered = await answer(APPROVED);

		expect(answered.status).toBe(APPROVED);
		expect(slotWrites).toEqual([
			{ kind: 'employee', ids: ['slot-bob'], status: APPROVED, answeredByUserId: BOB.id }
		]);
	});

	it('does not approve on a third slot answered by the same two people', async () => {
		asUser(BOB);
		const { answer } = answering(
			approvalRow({
				min_count: 3,
				employeeApprovals: [
					{ ...aliceSlot(), status: APPROVED, updatedByUserId: ALICE.id },
					bobSlot()
				],
				teamApprovals: [{ ...financeSlot(), status: APPROVED, updatedByUserId: ALICE.id }]
			})
		);

		expect((await answer(APPROVED)).status).toBe(REQUESTED);
	});
});

describe('RequestApprovalService.answer — the requester answers through no slot', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});
	afterEach(() => jest.restoreAllMocks());

	it.each([APPROVED, REFUSED])(
		'refuses the person who raised the request answering (%p) through an approver team: 403, nothing written',
		async (status) => {
			asUser(MALLORY);
			const { answer, slotWrites } = answering(
				approvalRow({ createdByUserId: MALLORY.id, employeeApprovals: [], min_count: 1 })
			);

			await expect(answer(status)).rejects.toBeInstanceOf(ForbiddenException);
			expect(slotWrites).toEqual([]);
		}
	);

	it('reads who the equipment sharing was filed by, and refuses its filer answering through a team slot', async () => {
		asUser(MALLORY);
		// The request approval was filed again by an editor of the sharing: its own requester is someone else.
		const { answer, slotWrites, requesterReads } = answering(
			approvalRow({
				requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
				requestId: SHARING_ID,
				createdByUserId: 'user-editor',
				employeeApprovals: [],
				min_count: 1
			}),
			{ userIds: [MALLORY.id], employeeIds: [] }
		);

		await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
		expect(requesterReads).toEqual([['equipment-sharing', SHARING_ID, TENANT]]);
		expect(slotWrites).toEqual([]);
	});

	it('refuses an employee the leave is for, answering through a team slot', async () => {
		asUser(MALLORY);
		const { answer, slotWrites, requesterReads } = answering(
			approvalRow({
				requestType: ApprovalPolicyTypesStringEnum.TIME_OFF,
				requestId: TIME_OFF_ID,
				employeeApprovals: [],
				min_count: 1
			}),
			{ userIds: ['user-manager'], employeeIds: [MALLORY.employeeId] }
		);

		await expect(answer(APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
		expect(requesterReads).toEqual([['time-off', TIME_OFF_ID, TENANT]]);
		expect(slotWrites).toEqual([]);
	});

	it('lets the other approvers answer a request that is for someone else', async () => {
		asUser(ALICE);
		const { answer, slotWrites } = answering(
			approvalRow({ requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING, requestId: SHARING_ID }),
			{ userIds: [MALLORY.id], employeeIds: [MALLORY.employeeId] }
		);

		await answer(APPROVED);

		expect(slotWrites.map((write) => write.ids)).toEqual([['slot-alice'], ['slot-finance']]);
	});

	it('reads nothing more for a tenant administrator, who decides any request', async () => {
		asUser(ADMIN);
		const { answer, requesterReads } = answering(
			approvalRow({ requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING, requestId: SHARING_ID }),
			{ userIds: [ADMIN.id], employeeIds: [] }
		);

		expect((await answer(APPROVED)).status).toBe(APPROVED);
		expect(requesterReads).toEqual([]);
	});

	it.each([
		['a request about no document', ApprovalPolicyTypesStringEnum.BUSINESS_TRIP, SHARING_ID],
		['a requestId that is not an identifier', ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING, 'sharing-1'],
		['no requestId', ApprovalPolicyTypesStringEnum.TIME_OFF, null]
	])('reads no document for %s', async (_, requestType, requestId) => {
		asUser(ALICE);
		const { answer, requesterReads } = answering(approvalRow({ requestType, requestId }));

		await answer(APPROVED);

		expect(requesterReads).toEqual([]);
	});
});

describe('requestersOfDocument', () => {
	it('reads a TypeORM row: its filer and the ids of its employees', () => {
		const row = { createdByUserId: 'user-filer', employees: [{ id: 'employee-1' }, { id: 'employee-2' }] };

		expect(requestersOfDocument(row)).toEqual({ userIds: ['user-filer'], employeeIds: ['employee-1', 'employee-2'] });
	});

	it('reads a MikroORM row: the filer from the relation key, the employees from the loaded collection', () => {
		const employees = { isInitialized: () => true, getItems: () => [{ id: 'employee-1' }] };

		expect(requestersOfDocument({ createdByUser: { id: 'user-filer' }, employees })).toEqual({
			userIds: ['user-filer'],
			employeeIds: ['employee-1']
		});
	});

	it('does not read a collection that was not loaded', () => {
		const employees = {
			isInitialized: () => false,
			getItems: () => {
				throw new Error('Collection not initialized');
			}
		};

		expect(requestersOfDocument({ createdByUserId: 'user-filer', employees })).toEqual({
			userIds: ['user-filer'],
			employeeIds: []
		});
	});

	it.each([null, undefined, 'not-a-row'])('answers nobody for %p', (row) => {
		expect(requestersOfDocument(row)).toEqual({ userIds: [], employeeIds: [] });
	});
});

describe('the requesters of the linked document on each ORM', () => {
	/** An equipment-sharing request, with Alice's slot and Mallory's. */
	const request = () => ({
		id: 'approval-1',
		tenantId: TENANT,
		organizationId: ORGANIZATION,
		status: REQUESTED,
		min_count: 1,
		createdByUserId: 'user-requester',
		requestType: ApprovalPolicyTypesStringEnum.EQUIPMENT_SHARING,
		requestId: SHARING_ID
	});

	afterEach(() => jest.restoreAllMocks());

	describe('TypeORM', () => {
		function typeOrm(sharing: Record<string, any>) {
			const query = {
				where: jest.fn().mockReturnThis(),
				setLock: jest.fn().mockReturnThis(),
				getOne: jest.fn(async () => request())
			};
			const manager = {
				createQueryBuilder: jest.fn(() => query),
				find: jest.fn(async (entity: unknown) =>
					entity === RequestApprovalEmployee
						? [{ id: 'slot-alice', employeeId: ALICE.employeeId, status: REQUESTED }]
						: []
				),
				findOne: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === EquipmentSharing ? sharing : null
				),
				update: jest.fn(async (..._args: unknown[]) => ({ affected: 1 }))
			};
			const repository = { manager: { transaction: jest.fn(async (work: any) => await work(manager)) } };
			const service = new RequestApprovalService(
				repository as any,
				...(Array.from({ length: 7 }, () => ({})) as [any, any, any, any, any, any, any])
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(request() as any);
			return { service, manager };
		}

		it('reads the filer and the employees on the transaction, and stamps the slot with the answering user', async () => {
			asUser(ALICE);
			const { service, manager } = typeOrm({ id: SHARING_ID, createdByUserId: MALLORY.id, employees: [] });

			await service.answer('approval-1', APPROVED);

			expect(manager.findOne).toHaveBeenCalledWith(EquipmentSharing, {
				where: { id: SHARING_ID, tenantId: TENANT },
				relations: { employees: true },
				loadEagerRelations: false
			});
			expect(manager.update).toHaveBeenCalledWith(
				RequestApprovalEmployee,
				expect.anything(),
				{ status: APPROVED, updatedByUserId: ALICE.id }
			);
		});

		it('refuses an approver the equipment sharing is for: 403, nothing written', async () => {
			asUser(ALICE);
			const { service, manager } = typeOrm({
				id: SHARING_ID,
				createdByUserId: MALLORY.id,
				employees: [{ id: ALICE.employeeId }]
			});

			await expect(service.answer('approval-1', APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
			expect(manager.update).not.toHaveBeenCalled();
		});
	});

	describe('MikroORM', () => {
		function mikroOrm(row: Record<string, any>, slots: Record<string, any>[]) {
			const em = {
				findOne: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === RequestApproval
						? row
						: entity === EquipmentSharing
						? {
								id: SHARING_ID,
								createdByUser: { id: 'user-filer' },
								employees: { isInitialized: () => true, getItems: () => [] }
						  }
						: null
				),
				find: jest.fn(async (entity: unknown) => (entity === RequestApprovalEmployee ? slots : [])),
				nativeUpdate: jest.fn(async (..._args: unknown[]) => 1),
				getMetadata: () => ({ find: () => undefined })
			};
			const mikroOrmRepository = {
				getEntityManager: () => ({ transactional: jest.fn(async (work: any) => work(em)) })
			};
			const service = new RequestApprovalService(
				{} as any,
				mikroOrmRepository as any,
				...(Array.from({ length: 6 }, () => ({})) as [any, any, any, any, any, any])
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue({ ...request() } as any);
			jest.spyOn(service as any, 'serialize').mockImplementation((entity: any) => ({ ...entity }));
			return { service, em };
		}

		it('reads the filer and the loaded employees from the table, on the transaction', async () => {
			asUser(ALICE);
			const { service, em } = mikroOrm(request(), [
				{ id: 'slot-alice', employee: { id: ALICE.employeeId }, status: REQUESTED }
			]);

			await service.answer('approval-1', APPROVED);

			expect(em.findOne).toHaveBeenCalledWith(
				EquipmentSharing,
				{ id: SHARING_ID, tenantId: TENANT },
				{ disableIdentityMap: true, populate: ['employees'] }
			);
			expect(em.nativeUpdate).toHaveBeenCalledWith(
				RequestApprovalEmployee,
				{ id: { $in: ['slot-alice'] }, tenantId: TENANT },
				{ status: APPROVED, updatedByUserId: ALICE.id }
			);
		});

		it('knows the requester from the relation key when the `persist: false` mirror is unhydrated: 403', async () => {
			asUser(MALLORY);
			const { createdByUserId: _mirror, ...stored } = request();
			const { service, em } = mikroOrm({ ...stored, createdByUser: { id: MALLORY.id } }, [
				{ id: 'slot-mallory', employee: { id: MALLORY.employeeId }, status: REQUESTED }
			]);

			await expect(service.answer('approval-1', APPROVED)).rejects.toBeInstanceOf(ForbiddenException);
			expect(em.nativeUpdate).not.toHaveBeenCalled();
		});
	});
});
