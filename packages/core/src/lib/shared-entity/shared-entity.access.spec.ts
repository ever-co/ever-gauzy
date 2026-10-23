import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { DataSource, EntityMetadata } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { TenantAwareCrudService } from '../core/crud';
import { ManagedEmployeeService } from '../employee/managed-employee.service';
import { assertCallerMayShare } from './shared-entity.access';
import { SharedEntityService } from './shared-entity.service';

/**
 * #10714 — a share link is read without signing in, so its author must be allowed to read what it
 * publishes. Creating or widening a share used to check the caller's tenant only.
 *
 * The data source stands in for the tables the checks read: the shared record's own table, the
 * organization's `allowEmployeeToSeeTrackedData` setting, the caller's employee record and team
 * memberships, and the time slot a screenshot belongs to.
 */

const TENANT = '80000000-0000-4000-8000-00000000000a';
const ORGANIZATION = '80000000-0000-4000-8000-0000000000a1';
const USER = '80000000-0000-4000-8000-0000000000b1';
/** The caller's employee record. */
const EMPLOYEE = '80000000-0000-4000-8000-0000000000e1';
/** An employee the caller neither is nor manages. */
const OTHER_EMPLOYEE = '80000000-0000-4000-8000-0000000000e2';
const TIME_SLOT = '80000000-0000-4000-8000-0000000000c1';
const RECORD = '80000000-0000-4000-8000-0000000000d1';

describe('assertCallerMayShare / SharedEntityService share checks', () => {
	let permissions: Set<PermissionsEnum>;
	/** The organization's `allowEmployeeToSeeTrackedData`. */
	let trackedDataVisible: boolean;
	/** Whether the caller manages a team in the organization (keeps tracked data visible to them). */
	let managesInOrganization: boolean;
	/** The record the shared table answers. */
	let sharedRecord: Record<string, unknown>;
	let created: jest.SpyInstance;

	const metadataOf = (name: string) =>
		({
			name,
			findColumnWithPropertyName: (column: string) =>
				['tenantId', 'organizationId'].includes(column) ? { propertyName: column } : undefined,
			findColumnWithPropertyPath: (column: string) =>
				['tenantId', 'organizationId'].includes(column) ? { propertyName: column } : undefined,
			findRelationWithPropertyPath: () => undefined
		}) as unknown as EntityMetadata;

	let repositories: Record<string, any>;
	let dataSource: DataSource;
	let managedEmployeeService: ManagedEmployeeService;

	/** The stand-ins, rebuilt per test so no mock state crosses tests. */
	const standIns = () => {
		repositories = {
			Organization: {
				find: jest.fn(async () => [{ id: ORGANIZATION, allowEmployeeToSeeTrackedData: trackedDataVisible }])
			},
			Employee: {
				findOne: jest.fn(async () => ({ id: EMPLOYEE, organizationId: ORGANIZATION })),
				find: jest.fn(async () => [{ id: EMPLOYEE, organizationId: ORGANIZATION }])
			},
			OrganizationTeamEmployee: { existsBy: jest.fn(async () => managesInOrganization) },
			OrganizationProjectEmployee: { existsBy: jest.fn(async () => false) },
			TimeSlot: {
				findOne: jest.fn(async () => ({ id: TIME_SLOT, employeeId: EMPLOYEE, organizationId: ORGANIZATION }))
			}
		};

		/** Every shared type reads its record from the same stand-in table. */
		dataSource = {
			getRepository: (name: string) =>
				repositories[name] ?? { metadata: metadataOf(name), findOne: jest.fn(async () => sharedRecord) }
		} as unknown as DataSource;

		/** As the real service answers it: every employee for CHANGE_SELECTED_EMPLOYEE, otherwise the caller's own. */
		managedEmployeeService = {
			canManageEmployee: jest.fn(
				async (target: string) =>
					RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) || target === EMPLOYEE
			),
			isManagerOfTeamsOrProjects: jest.fn(async () => false)
		} as unknown as ManagedEmployeeService;
	};

	beforeEach(() => {
		standIns();
		permissions = new Set();
		trackedDataVisible = true;
		managesInOrganization = false;
		sharedRecord = { id: RECORD, tenantId: TENANT, organizationId: ORGANIZATION };

		jest.spyOn(RequestContext, 'currentRequestContext').mockReturnValue({} as any);
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
			id: USER,
			tenantId: TENANT,
			employeeId: EMPLOYEE
		} as any);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
		// As in production: a CHANGE_SELECTED_EMPLOYEE holder has no current employee id.
		jest.spyOn(RequestContext, 'currentEmployeeId').mockImplementation(() =>
			permissions.has(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE) ? null : EMPLOYEE
		);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission) => permissions.has(permission));
		jest.spyOn(RequestContext, 'hasAnyPermission').mockImplementation((required) =>
			required.some((permission) => permissions.has(permission))
		);
		created = jest.spyOn(TenantAwareCrudService.prototype, 'create').mockResolvedValue({ id: 'share-1' } as any);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The check alone, for a share of the record's own fields. */
	const share = (name: string, record: Record<string, unknown>) =>
		assertCallerMayShare(metadataOf(name), record, { fields: ['id'] }, dataSource, managedEmployeeService);

	describe('creating a share through the service', () => {
		const service = () => {
			const instance = Object.create(SharedEntityService.prototype) as SharedEntityService;
			Object.assign(instance, { dataSource, managedEmployeeService });
			return instance;
		};
		const create = (entity: string) =>
			service().create({ entity, entityId: RECORD, shareRules: { fields: ['id'] } } as any);

		it('refuses an invoice the caller may not read, and creates no share', async () => {
			await expect(create('Invoice')).rejects.toThrow(ForbiddenException);
			expect(created).not.toHaveBeenCalled();
		});

		it('shares an invoice the caller may read', async () => {
			permissions.add(PermissionsEnum.INVOICES_VIEW);

			await expect(create('Invoice')).resolves.toEqual({ id: 'share-1' });
		});

		it('refuses a task without ORG_TASK_VIEW, and shares it with that permission', async () => {
			await expect(create('Task')).rejects.toThrow(ForbiddenException);
			expect(created).not.toHaveBeenCalled();

			permissions.add(PermissionsEnum.ORG_TASK_VIEW);
			await expect(create('Task')).resolves.toEqual({ id: 'share-1' });
		});

		it('keeps sharing a type without a read rule, as before', async () => {
			await expect(create('Equipment')).resolves.toEqual({ id: 'share-1' });
		});
	});

	describe("tracked data follows the organization's allowEmployeeToSeeTrackedData", () => {
		const ownTimeLog = () => ({ ...sharedRecord, employeeId: EMPLOYEE });

		it('shares an own time log while the organization lets employees see tracked data', async () => {
			await expect(share('TimeLog', ownTimeLog())).resolves.toBeUndefined();
		});

		it('refuses an own time log while the organization hides tracked data', async () => {
			trackedDataVisible = false;

			await expect(share('TimeLog', ownTimeLog())).rejects.toThrow(ForbiddenException);
		});

		it('refuses a screenshot of an own time slot while the organization hides tracked data', async () => {
			trackedDataVisible = false;

			await expect(share('Screenshot', { ...sharedRecord, timeSlotId: TIME_SLOT })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('lets a manager in that organization share it, as the read routes do', async () => {
			trackedDataVisible = false;
			managesInOrganization = true;

			await expect(share('TimeLog', ownTimeLog())).resolves.toBeUndefined();
		});

		it('refuses a time log of an employee the caller does not manage', async () => {
			await expect(share('TimeLog', { ...sharedRecord, employeeId: OTHER_EMPLOYEE })).rejects.toThrow(
				ForbiddenException
			);
		});
	});

	describe.each(['Video', 'Camshot', 'Soundshot'])('a media plugin recording (%s)', (name) => {
		it('is shared by the employee who uploaded it', async () => {
			await expect(share(name, { ...sharedRecord, uploadedById: EMPLOYEE })).resolves.toBeUndefined();
		});

		it('is refused to another employee, as its read routes refuse them', async () => {
			await expect(share(name, { ...sharedRecord, uploadedById: OTHER_EMPLOYEE })).rejects.toThrow(
				ForbiddenException
			);
		});

		it('is refused to its uploader while the organization hides tracked data', async () => {
			trackedDataVisible = false;

			await expect(share(name, { ...sharedRecord, uploadedById: EMPLOYEE })).rejects.toThrow(ForbiddenException);
		});

		it('is shared by a CHANGE_SELECTED_EMPLOYEE holder, whoever uploaded it', async () => {
			permissions.add(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE);

			await expect(share(name, { ...sharedRecord, uploadedById: OTHER_EMPLOYEE })).resolves.toBeUndefined();
		});
	});
});
