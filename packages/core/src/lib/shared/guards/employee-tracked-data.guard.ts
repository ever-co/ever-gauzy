import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { isUUID } from 'class-validator';
import { ID, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';

/**
 * Guard to enforce the `allowEmployeeToSeeTrackedData` organization setting on the read routes that
 * expose tracked data (screenshots, activity, app/URL history, time logs, videos and statistics).
 *
 * It only ever restricts: it runs after the controller's own guards, and a request it lets through is
 * scoped by the service exactly as before.
 *
 * Allows the request when:
 * 1. The caller has `CHANGE_SELECTED_EMPLOYEE` permission (Admin / Super Admin), OR
 * 2. The caller has no employee record (they have no tracked data of their own, so their role-based
 *    access is unchanged), OR
 * 3. The setting is not `false` in every organization the request touches: the organization of the
 *    caller's employee record, and each `organizationId` the request names, OR
 * 4. The caller manages an active team or project in each organization where the setting is `false`.
 *
 * Blocks (403) otherwise, and when the tenant, the employee record or a named organization cannot be
 * found in the caller's tenant. A malformed `organizationId` gets 400.
 *
 * Why the employee's own organization and not only the requested one: an employee's tracked data lives in
 * the organization of their employee record. Some guarded routes read by record id or scope by a field the
 * guard does not see (custom-tracking `time-slot/:id`, the videos `where` filter, the body of
 * POST routes), so a client-chosen `organizationId` of another organization alone must not decide.
 *
 * The guard depends only on the global `DataSource`, so any module (plugins included) can use it without
 * importing extra providers.
 */
@Injectable()
export class EmployeeTrackedDataGuard implements CanActivate {
	constructor(private readonly dataSource: DataSource) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest();

		const organizationIds = [
			request?.query?.organizationId,
			request?.body?.organizationId,
			request?.params?.organizationId
		];

		if (!(await canViewTrackedData(this.dataSource, organizationIds))) {
			throw new ForbiddenException('Employees are not allowed to view tracked data in this organization');
		}
		return true;
	}
}

/**
 * Decides whether the current caller may view tracked data, with the rules documented on
 * {@link EmployeeTrackedDataGuard}. Shared by the guard and by the endpoint the web UI uses to hide
 * navigation, so both apply the same rule.
 *
 * @param dataSource - The TypeORM data source.
 * @param requestedOrganizationIds - `organizationId` values named by the request; empty values are ignored.
 * @returns `false` when the setting hides tracked data from the caller.
 * @throws BadRequestException when a requested `organizationId` is not a single UUID string.
 * @throws ForbiddenException when the tenant, the employee record or a requested organization is not found.
 */
export async function canViewTrackedData(
	dataSource: DataSource,
	requestedOrganizationIds: unknown[] = []
): Promise<boolean> {
	// Admin / Super Admin with CHANGE_SELECTED_EMPLOYEE
	if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
		return true;
	}

	// No employee record: no tracked data of their own, role-based access applies unchanged
	const employeeId: ID = RequestContext.currentUser()?.employeeId;
	if (!employeeId) {
		return true;
	}

	const requested = requestedOrganizationIds
		.filter((value) => value !== undefined && value !== null && value !== '')
		.map((value) => {
			// A repeated or structured parameter (?organizationId=a&organizationId=b, organizationId[x]=) is not a string
			if (typeof value !== 'string' || !isUUID(value)) {
				throw new BadRequestException('Invalid organizationId');
			}
			return value;
		});

	const tenantId = RequestContext.currentTenantId();
	if (!tenantId) {
		throw new ForbiddenException('Tenant context is required to access tracked data');
	}

	const employee = await dataSource.getRepository('Employee').findOne({
		where: { id: employeeId, tenantId },
		select: { id: true, organizationId: true }
	});
	if (!employee?.organizationId) {
		throw new ForbiddenException('Employee not found or not accessible');
	}

	const organizationIds: ID[] = [...new Set<ID>([employee.organizationId, ...requested])];
	const organizations = await dataSource.getRepository('Organization').find({
		where: { id: In(organizationIds), tenantId },
		select: { id: true, allowEmployeeToSeeTrackedData: true }
	});

	// Fail closed: an organization that does not exist in the caller's tenant
	if (organizations.length !== organizationIds.length) {
		throw new ForbiddenException('Organization not found or not accessible');
	}

	for (const organization of organizations) {
		// The column is NOT NULL DEFAULT true; only an explicit false (0 from a raw tinyint) hides data
		const allowed = organization['allowEmployeeToSeeTrackedData'];
		if (allowed !== false && allowed !== 0) {
			continue;
		}
		// Setting is off: managers of a team or project in this organization keep their access
		if (!(await isManagerInOrganization(dataSource, employeeId, organization.id, tenantId))) {
			return false;
		}
	}

	return true;
}

/**
 * Whether the employee is an active manager of any team or project in the organization.
 */
async function isManagerInOrganization(
	dataSource: DataSource,
	employeeId: ID,
	organizationId: ID,
	tenantId: ID
): Promise<boolean> {
	const where = { employeeId, organizationId, tenantId, isManager: true, isActive: true, isArchived: false };

	if (await dataSource.getRepository('OrganizationTeamEmployee').existsBy(where)) {
		return true;
	}
	return await dataSource.getRepository('OrganizationProjectEmployee').existsBy(where);
}
