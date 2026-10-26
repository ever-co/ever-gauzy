// Must stay first: loads the entity graph before the service pulls an entity.
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { In } from 'typeorm';
import { RequestApprovalStatusTypesEnum, RolesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationTeamEmployee, RequestApproval } from '../core/entities/internal';
import { MultiORMEnum } from '../core/utils';
import { IRequestApprovalRequestedFor, REQUESTER_DOES_NOT_ANSWER } from '../request-approval/request-approval-decision';
import { EquipmentSharingStatusCommand } from './commands/equipment-sharing.status.command';
import { EquipmentSharingStatusHandler } from './commands/handlers/equipment-sharing.status.handler';
import { EquipmentSharing } from './equipment-sharing.entity';
import { EquipmentSharingService, IEquipmentSharingDecisionTransaction } from './equipment-sharing.service';

/**
 * Owner decision Q9 (2026-10-24), on the equipment sharing's own decision routes: `PUT /equipment-sharing/approval|
 * refuse/:id` and the GraphQL `approveEquipmentSharing` / `refuseEquipmentSharing` (`EquipmentSharingStatusHandler` →
 * `decideWithRequestApproval`).
 *
 * The request approval's answer already refuses the person a request is for. These routes decided the sharing for any
 * holder of `EQUIPMENT_APPROVE_REQUEST` / `ORG_EQUIPMENT_SHARING_EDIT`, the person who filed it or the employees it is
 * for included. They now apply the same rule: the user who raised the sharing's approval, the user who filed the
 * sharing and the employees it is for do not approve or refuse it — unless they are a tenant administrator, who
 * decides any request, as on the answer route. The check is made on the decision's transaction, after the approval's
 * row lock (the lock an in-place edit of the memberships takes too), and before anything is written.
 *
 * The people a sharing is for include the active members of the teams it is for (follow-up of #11413): a member of
 * such a team could still approve it, since only the employees it names were read.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const { REQUESTED, APPROVED, REFUSED } = RequestApprovalStatusTypesEnum;

const TENANT = 'tenant-a';
const ORG = 'org-a';
const ID = 'sharing-1';
const APPROVAL_ID = 'approval-1';

const MANAGER = { id: 'user-manager', employeeId: 'employee-manager', role: RolesEnum.MANAGER };
const ADMIN = { id: 'user-admin', employeeId: 'employee-admin', role: RolesEnum.ADMIN };

type Row = Record<string, any>;

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function asUser(user: { id: string; employeeId: string; role: RolesEnum }) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: user.id,
		employeeId: user.employeeId,
		tenantId: TENANT,
		lastOrganizationId: ORG,
		role: { name: user.role },
		permissions: []
	} as any);
}

const sharing = () => ({ id: ID, tenantId: TENANT, organizationId: ORG, status: REQUESTED, version: 2 });
const approvalRow = (overrides: Row = {}) => ({
	id: APPROVAL_ID,
	requestId: ID,
	organizationId: ORG,
	createdByUserId: 'user-requester',
	...overrides
});

/** The decision over a fake transaction that logs its statements. */
function system({
	approval = approvalRow(),
	requestedFor = { userIds: [], employeeIds: [] }
}: { approval?: Row; requestedFor?: IRequestApprovalRequestedFor } = {}) {
	const statements: string[] = [];
	const service = new EquipmentSharingService(
		{ metadata: { tableName: 'equipment_sharing' }, findOne: jest.fn(async () => sharing()) } as any,
		{} as any,
		{} as any,
		{ dbConnectionOptions: { type: 'postgres' } } as any
	);
	jest.spyOn(service, 'findOneByIdString').mockResolvedValue(sharing() as any);
	jest.spyOn(service as any, 'decisionTransaction').mockImplementation(async (work: any) => {
		const transaction: IEquipmentSharingDecisionTransaction = {
			lockRequestApproval: async () => {
				statements.push('lockRequestApproval');
				return copy(approval) as any;
			},
			readRequesters: async () => {
				statements.push('readRequesters');
				return requestedFor;
			},
			writeSharingStatus: async () => {
				statements.push('writeSharingStatus');
				return 1;
			},
			writeRequestApprovalStatus: async () => {
				statements.push('writeRequestApprovalStatus');
			}
		};
		return await work(transaction);
	});
	const decide = (status: number) =>
		service.decideWithRequestApproval(ID, status, APPROVAL_ID).then(
			(value) => ({ value, error: undefined as any }),
			(error) => ({ value: undefined, error })
		);
	return { service, statements, decide };
}

describe('deciding an equipment sharing: nobody decides one they raised or that is for them', () => {
	afterEach(() => jest.restoreAllMocks());

	it.each([APPROVED, REFUSED])(
		'refuses (%p) a decider who filed the sharing: 403, after the approval lock, nothing written',
		async (status) => {
			asUser(MANAGER);
			const { decide, statements } = system({ requestedFor: { userIds: [MANAGER.id], employeeIds: [] } });

			const { error } = await decide(status);

			expect(error).toBeInstanceOf(ForbiddenException);
			expect(error.message).toBe(REQUESTER_DOES_NOT_ANSWER);
			expect(statements).toEqual(['lockRequestApproval', 'readRequesters']);
		}
	);

	it.each([APPROVED, REFUSED])('refuses (%p) a decider the sharing is for', async (status) => {
		asUser(MANAGER);
		const { decide, statements } = system({
			requestedFor: { userIds: ['user-filer'], employeeIds: ['employee-other', MANAGER.employeeId] }
		});

		const { error } = await decide(status);

		expect(error).toBeInstanceOf(ForbiddenException);
		expect(statements).not.toContain('writeSharingStatus');
		expect(statements).not.toContain('writeRequestApprovalStatus');
	});

	it('refuses the user who raised the sharing’s request approval', async () => {
		asUser(MANAGER);
		const { decide, statements } = system({ approval: approvalRow({ createdByUserId: MANAGER.id }) });

		const { error } = await decide(APPROVED);

		expect(error).toBeInstanceOf(ForbiddenException);
		expect(statements).toEqual(['lockRequestApproval', 'readRequesters']);
	});

	it('lets a decider the sharing is not for decide it, reading who it is for after the lock and before any write', async () => {
		asUser(MANAGER);
		const { decide, statements } = system({
			requestedFor: { userIds: ['user-filer'], employeeIds: ['employee-other'] }
		});

		const { error } = await decide(APPROVED);

		expect(error).toBeUndefined();
		expect(statements).toEqual([
			'lockRequestApproval',
			'readRequesters',
			'writeSharingStatus',
			'writeRequestApprovalStatus'
		]);
	});

	it.each([APPROVED, REFUSED])(
		'still lets a tenant administrator decide (%p) a sharing they filed, as on the answer route',
		async (status) => {
			asUser(ADMIN);
			const { decide, statements } = system({
				approval: approvalRow({ createdByUserId: ADMIN.id }),
				requestedFor: { userIds: [ADMIN.id], employeeIds: [ADMIN.employeeId] }
			});

			const { error } = await decide(status);

			expect(error).toBeUndefined();
			// The administrator's decision reads nothing more.
			expect(statements).toEqual(['lockRequestApproval', 'writeSharingStatus', 'writeRequestApprovalStatus']);
		}
	);

	it('is the rule of the REST and GraphQL decision routes, which dispatch the status command', async () => {
		asUser(MANAGER);
		const { service, statements } = system({ requestedFor: { userIds: [MANAGER.id], employeeIds: [] } });
		const approvals = { findOneByWhereOptions: jest.fn(async () => approvalRow()) };
		const handler = new EquipmentSharingStatusHandler(service, approvals as any);

		await expect(handler.execute(new EquipmentSharingStatusCommand(ID, APPROVED))).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(statements).not.toContain('writeSharingStatus');
	});
});

describe('who a sharing is for, on each ORM', () => {
	afterEach(() => jest.restoreAllMocks());

	describe('TypeORM', () => {
		function typeOrm(approval: Row, filed: Row, memberships: Row[] = []) {
			const query = {
				where: jest.fn().mockReturnThis(),
				setLock: jest.fn().mockReturnThis(),
				getOne: jest.fn(async () => approval)
			};
			const manager = {
				createQueryBuilder: jest.fn(() => query),
				findOne: jest.fn(async (..._args: unknown[]) => filed),
				// The active memberships of the teams the sharing is for.
				find: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === OrganizationTeamEmployee ? memberships : []
				),
				update: jest.fn(async (..._args: unknown[]) => ({ affected: 1 }))
			};
			const service = new EquipmentSharingService(
				{
					metadata: { tableName: 'equipment_sharing' },
					findOne: jest.fn(async () => sharing()),
					manager: { transaction: jest.fn(async (work: any) => await work(manager)) }
				} as any,
				{} as any,
				{} as any,
				{ dbConnectionOptions: { type: 'postgres' } } as any
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(sharing() as any);
			return { service, manager };
		}

		it('reads the filer and the employees on the transaction, and refuses an employee the sharing is for', async () => {
			asUser(MANAGER);
			const { service, manager } = typeOrm(approvalRow(), {
				id: ID,
				createdByUserId: 'user-filer',
				employees: [{ id: MANAGER.employeeId }]
			});

			const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).catch((reason) => reason);

			expect(error).toBeInstanceOf(ForbiddenException);
			expect(manager.findOne).toHaveBeenCalledWith(EquipmentSharing, {
				where: { id: ID, tenantId: TENANT },
				relations: { employees: true, teams: true },
				loadEagerRelations: false
			});
			// A sharing for no team reads no membership.
			expect(manager.find).not.toHaveBeenCalled();
			expect(manager.update).not.toHaveBeenCalled();
		});

		it.each([APPROVED, REFUSED])(
			'refuses (%p) an active member of a team the sharing is for: 403, after the lock, nothing written',
			async (status) => {
				asUser(MANAGER);
				const { service, manager } = typeOrm(
					approvalRow(),
					{ id: ID, createdByUserId: 'user-filer', employees: [], teams: [{ id: 'team-design' }] },
					[{ organizationTeamId: 'team-design', employeeId: MANAGER.employeeId, isActive: true }]
				);

				const error = await service
					.decideWithRequestApproval(ID, status, APPROVAL_ID)
					.catch((reason) => reason);

				expect(error).toBeInstanceOf(ForbiddenException);
				expect(error.message).toBe(REQUESTER_DOES_NOT_ANSWER);
				// The members are read on the decision's transaction, inside the tenant, active memberships only.
				expect(manager.find).toHaveBeenCalledWith(OrganizationTeamEmployee, {
					where: { organizationTeamId: In(['team-design']), tenantId: TENANT, isActive: true }
				});
				// After the approval's lock (the query builder's), and nothing written.
				expect(manager.createQueryBuilder.mock.invocationCallOrder[0]).toBeLessThan(
					manager.find.mock.invocationCallOrder[0]
				);
				expect(manager.update).not.toHaveBeenCalled();
			}
		);

		it('lets a decider who is not a member of the sharing’s teams decide it', async () => {
			asUser(MANAGER);
			const { service, manager } = typeOrm(
				approvalRow(),
				{ id: ID, createdByUserId: 'user-filer', employees: [], teams: [{ id: 'team-design' }] },
				[{ organizationTeamId: 'team-design', employeeId: 'employee-other', isActive: true }]
			);

			await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID);

			expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing, RequestApproval]);
		});

		it('still lets a tenant administrator who is a member of the sharing’s team decide it, reading nothing more', async () => {
			asUser(ADMIN);
			const { service, manager } = typeOrm(
				approvalRow(),
				{ id: ID, createdByUserId: 'user-filer', employees: [], teams: [{ id: 'team-design' }] },
				[{ organizationTeamId: 'team-design', employeeId: ADMIN.employeeId, isActive: true }]
			);

			await service.decideWithRequestApproval(ID, REFUSED, APPROVAL_ID);

			expect(manager.findOne).not.toHaveBeenCalled();
			expect(manager.find).not.toHaveBeenCalled();
			expect(manager.update.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing, RequestApproval]);
		});

		it('refuses the user who raised the approval, as the locked read finds it', async () => {
			asUser(MANAGER);
			const { service, manager } = typeOrm(approvalRow({ createdByUserId: MANAGER.id }), {
				id: ID,
				employees: []
			});

			const error = await service.decideWithRequestApproval(ID, REFUSED, APPROVAL_ID).catch((reason) => reason);

			expect(error).toBeInstanceOf(ForbiddenException);
			expect(manager.update).not.toHaveBeenCalled();
		});
	});

	describe('MikroORM', () => {
		function mikroOrm(approval: Row, filed: Row, memberships: Row[] = []) {
			const em = {
				findOne: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === RequestApproval ? approval : filed
				),
				find: jest.fn(async (entity: unknown, ..._args: unknown[]) =>
					entity === OrganizationTeamEmployee ? memberships : []
				),
				nativeUpdate: jest.fn(async (..._args: unknown[]) => 1),
				getMetadata: () => ({ find: () => undefined })
			};
			const service = new EquipmentSharingService(
				{ metadata: { tableName: 'equipment_sharing' } } as any,
				{ getEntityManager: () => ({ transactional: jest.fn(async (work: any) => await work(em)) }) } as any,
				{} as any,
				{ dbConnectionOptions: { type: 'postgres' } } as any
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			jest.spyOn(service, 'findOneByIdString').mockResolvedValue(sharing() as any);
			jest.spyOn(service as any, 'mikroOrmUpdateRow').mockImplementation((row: any) => row);
			return { service, em };
		}

		it('knows who raised the approval from the relation key when the `persist: false` mirror is unhydrated', async () => {
			asUser(MANAGER);
			const { createdByUserId: _mirror, ...stored } = approvalRow();
			const { service, em } = mikroOrm({ ...stored, createdByUser: { id: MANAGER.id } }, { id: ID });

			const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).catch((reason) => reason);

			expect(error).toBeInstanceOf(ForbiddenException);
			expect(em.nativeUpdate).not.toHaveBeenCalled();
		});

		it('reads the filer and the loaded employees from the table, on the transaction', async () => {
			asUser(MANAGER);
			const employees = { isInitialized: () => true, getItems: () => [{ id: 'employee-other' }] };
			const { service, em } = mikroOrm(approvalRow(), { id: ID, createdByUser: { id: 'user-filer' }, employees });

			await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID);

			expect(em.findOne).toHaveBeenCalledWith(
				EquipmentSharing,
				{ id: ID, tenantId: TENANT },
				{ disableIdentityMap: true, populate: ['employees', 'teams'] }
			);
			expect(em.find).not.toHaveBeenCalled();
			expect(em.nativeUpdate.mock.calls.map(([entity]) => entity)).toEqual([EquipmentSharing, RequestApproval]);
		});

		it('refuses an active member of a team the sharing is for, read from the table on the transaction', async () => {
			asUser(MANAGER);
			const teams = { isInitialized: () => true, getItems: () => [{ id: 'team-design' }] };
			const employees = { isInitialized: () => true, getItems: () => [] };
			const { service, em } = mikroOrm(approvalRow(), { id: ID, employees, teams }, [
				{ organizationTeam: { id: 'team-design' }, employee: { id: MANAGER.employeeId } }
			]);

			const error = await service.decideWithRequestApproval(ID, APPROVED, APPROVAL_ID).catch((reason) => reason);

			expect(error).toBeInstanceOf(ForbiddenException);
			expect(em.find).toHaveBeenCalledWith(
				OrganizationTeamEmployee,
				{ organizationTeamId: { $in: ['team-design'] }, tenantId: TENANT, isActive: true },
				{ disableIdentityMap: true }
			);
			expect(em.nativeUpdate).not.toHaveBeenCalled();
		});
	});
});
