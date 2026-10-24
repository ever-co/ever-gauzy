// Must stay first: loads the entity graph before the service pulls an entity (see activity.controller.spec.ts).
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { PermissionsEnum, RequestApprovalStatusTypesEnum, RolesEnum, StatusTypesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TimeOffPolicy } from '../core/entities/internal';
import { TimeOffRequestService } from './time-off-request.service';

/**
 * F2 (privilege-escalation audit 2026-10-24): `POST /time-off-request` (`ALL_ORG_EDIT` | `TIME_OFF_ADD`) and
 * `PUT /time-off-request/:id` (`ALL_ORG_EDIT` | `TIME_OFF_DELETE`), and their GraphQL twins, stored the body as
 * given. A role a tenant granted `TIME_OFF_ADD` filed leave already `APPROVED` — with its approval row approved
 * too — for any colleague, and `TIME_OFF_DELETE` approved leave by editing it, skipping the
 * `@Roles(SUPER_ADMIN, ADMIN)` approve route.
 *
 * The real service runs over fake repositories: the save, the approval row's save and the policy lookup.
 */

const TENANT = 'tenant-a';
const ORGANIZATION = 'organization-a';
const OWN = 'employee-own';
const COLLEAGUE = 'employee-colleague';

/** The policies of the caller's organization: one that needs approval and one that does not. */
const POLICIES = [
	{ id: 'policy-approval', tenantId: TENANT, organizationId: ORGANIZATION, requiresApproval: true },
	{ id: 'policy-no-approval', tenantId: TENANT, organizationId: ORGANIZATION, requiresApproval: false },
	{ id: 'policy-foreign', tenantId: 'tenant-b', organizationId: ORGANIZATION, requiresApproval: false }
];

function asUser(options: { employeeId: string | null; role: RolesEnum; permissions: PermissionsEnum[] }) {
	jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
		id: 'user-1',
		tenantId: TENANT,
		lastOrganizationId: ORGANIZATION,
		employeeId: options.employeeId,
		role: { name: options.role },
		permissions: options.permissions
	} as any);
}

/** A role the tenant let file time off, with no grant to act for other employees. */
const asGrantedEmployee = () =>
	asUser({
		employeeId: OWN,
		role: RolesEnum.EMPLOYEE,
		permissions: [PermissionsEnum.TIME_OFF_ADD, PermissionsEnum.TIME_OFF_DELETE]
	});

const asAdmin = () =>
	asUser({
		employeeId: null,
		role: RolesEnum.ADMIN,
		permissions: [
			PermissionsEnum.ALL_ORG_EDIT,
			PermissionsEnum.TIME_OFF_ADD,
			PermissionsEnum.TIME_OFF_EDIT,
			PermissionsEnum.CHANGE_SELECTED_EMPLOYEE
		]
	});

function surfaces() {
	const manager = {
		findOneBy: jest.fn(async (entity: unknown, where: any) =>
			entity === TimeOffPolicy
				? (POLICIES.find(
						(policy) =>
							policy.id === where.id &&
							policy.tenantId === where.tenantId &&
							policy.organizationId === where.organizationId
					) ?? null)
				: null
		)
	};
	const approvals = { save: jest.fn(async (row: any) => row) };
	const service = new TimeOffRequestService({ manager } as any, {} as any, approvals as any);
	const save = jest.spyOn(service, 'save').mockImplementation(async (row: any) => ({ id: 'time-off-1', ...row }));
	const findOneByIdString = jest
		.spyOn(service, 'findOneByIdString')
		.mockResolvedValue({ id: 'time-off-1', status: StatusTypesEnum.REQUESTED } as any);

	return { service, save, approvals, manager, findOneByIdString };
}

/** What the request dialog sends: its status is the browser's choice, its employees the dialog's list. */
const dialogBody = (overrides: Record<string, unknown> = {}) =>
	({
		organizationId: ORGANIZATION,
		tenantId: TENANT,
		start: '2026-11-02',
		end: '2026-11-06',
		requestDate: '2026-10-24',
		isHoliday: false,
		description: 'Family trip',
		policy: { id: 'policy-approval', name: 'Paid leave', requiresApproval: true },
		status: StatusTypesEnum.APPROVED,
		employees: [{ id: COLLEAGUE }],
		...overrides
	}) as any;

describe('TimeOffRequestService write whitelist (F2)', () => {
	beforeEach(() => {
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
	});
	afterEach(() => jest.restoreAllMocks());

	describe('create', () => {
		it('ignores a body status of APPROVED: the request and its approval row are filed REQUESTED', async () => {
			asGrantedEmployee();
			const { service, save, approvals } = surfaces();

			await service.create(dialogBody());

			expect(save.mock.calls[0][0]).toEqual(expect.objectContaining({ status: StatusTypesEnum.REQUESTED }));
			expect(approvals.save).toHaveBeenCalledWith(
				expect.objectContaining({ status: RequestApprovalStatusTypesEnum.REQUESTED, tenantId: TENANT })
			);
		});

		it('files APPROVED when the stored policy requires no approval, whatever the body says', async () => {
			asGrantedEmployee();
			const { service, save, approvals, manager } = surfaces();

			// The body claims the policy needs approval and asks for REQUESTED; the store says otherwise.
			await service.create(
				dialogBody({ policy: { id: 'policy-no-approval', requiresApproval: true }, status: undefined })
			);

			expect(save.mock.calls[0][0]).toEqual(expect.objectContaining({ status: StatusTypesEnum.APPROVED }));
			expect(approvals.save).toHaveBeenCalledWith(
				expect.objectContaining({ status: RequestApprovalStatusTypesEnum.APPROVED })
			);
			expect(manager.findOneBy).toHaveBeenCalledWith(TimeOffPolicy, {
				id: 'policy-no-approval',
				tenantId: TENANT,
				organizationId: ORGANIZATION
			});
		});

		it("does not take another tenant's no-approval policy as a reason to approve", async () => {
			asGrantedEmployee();
			const { service, save } = surfaces();

			await service.create(dialogBody({ policy: { id: 'policy-foreign' } }));

			expect(save.mock.calls[0][0]).toEqual(expect.objectContaining({ status: StatusTypesEnum.REQUESTED }));
		});

		it('files a caller who may not act for other employees for themselves, not the colleague the body names', async () => {
			asGrantedEmployee();
			const { service, save } = surfaces();

			await service.create(dialogBody({ employees: [{ id: COLLEAGUE }, { id: OWN }] }));

			expect(save.mock.calls[0][0].employees).toEqual([{ id: OWN }]);
		});

		it('refuses a caller who may not act for others and has no employee record', async () => {
			asUser({ employeeId: null, role: RolesEnum.VIEWER, permissions: [PermissionsEnum.TIME_OFF_ADD] });
			const { service, save } = surfaces();

			await expect(service.create(dialogBody())).rejects.toBeInstanceOf(ForbiddenException);
			expect(save).not.toHaveBeenCalled();
		});

		it("files the employees an administrator names (the admin's request and holiday dialogs)", async () => {
			asAdmin();
			const { service, save } = surfaces();

			await service.create(dialogBody({ isHoliday: true, employees: [{ id: COLLEAGUE }, { id: OWN }] }));

			const [row] = save.mock.calls[0];
			expect(row.employees).toEqual([{ id: COLLEAGUE }, { id: OWN }]);
			// An administrator's body status is not the decision either: the approve route is.
			expect(row.status).toBe(StatusTypesEnum.REQUESTED);
		});

		it('does not write body members outside the whitelist', async () => {
			asAdmin();
			const { service, save } = surfaces();

			await service.create(dialogBody({ id: 'existing-row', createdByUserId: 'user-x', deletedAt: new Date() }));

			// The row is an entity instance, whose declared fields exist unset: compare the values.
			const [row] = save.mock.calls[0];
			for (const member of ['id', 'createdByUserId', 'deletedAt']) {
				expect(row[member]).toBeUndefined();
			}
		});
	});

	describe('updateTimeOffByAdmin (PUT /time-off-request/:id, GraphQL updateTimeOffRequest)', () => {
		it('never writes the body status: approving goes through the approve route', async () => {
			asUser({
				employeeId: OWN,
				role: RolesEnum.EMPLOYEE,
				permissions: [PermissionsEnum.TIME_OFF_DELETE]
			});
			const { service, save } = surfaces();

			// The GraphQL update states the status alone.
			await service.updateTimeOffByAdmin('time-off-1', { status: StatusTypesEnum.APPROVED } as any);
			await service.updateTimeOffByAdmin('time-off-1', dialogBody({ status: StatusTypesEnum.APPROVED }));

			for (const [row] of save.mock.calls) {
				expect(row).not.toHaveProperty('status');
				expect(row.id).toBe('time-off-1');
			}
		});

		it('keeps the stored employees for a caller who may not act for others', async () => {
			asGrantedEmployee();
			const { service, save } = surfaces();

			await service.updateTimeOffByAdmin('time-off-1', dialogBody({ employees: [{ id: COLLEAGUE }] }));

			expect(save.mock.calls[0][0]).not.toHaveProperty('employees');
		});

		it('writes the edit itself, and the Archive action', async () => {
			asAdmin();
			const { service, save } = surfaces();

			await service.updateTimeOffByAdmin(
				'time-off-1',
				dialogBody({ description: 'Moved', isArchived: true, employees: [{ id: COLLEAGUE }] })
			);

			expect(save.mock.calls[0][0]).toEqual(
				expect.objectContaining({
					id: 'time-off-1',
					description: 'Moved',
					isArchived: true,
					policy: { id: 'policy-approval' },
					employees: [{ id: COLLEAGUE }]
				})
			);
			// The row keeps its organization and tenant.
			expect(save.mock.calls[0][0]).not.toHaveProperty('organizationId');
			expect(save.mock.calls[0][0]).not.toHaveProperty('tenantId');
		});
	});
});
