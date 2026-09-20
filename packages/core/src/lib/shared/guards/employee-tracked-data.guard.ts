import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { isUUID } from 'class-validator';
import { ID, PermissionsEnum, RolesEnum } from '@gauzy/contracts';
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
 * 2. The caller has no employee record in the tenant — read from the database, not from the token claim
 *    (they have no tracked data of their own, so their role-based access is unchanged), OR
 * 3. The setting is not `false` in every organization the request touches that exists in the caller's
 *    tenant: the caller's own organization, and each `organizationId` the request names, OR
 * 4. The caller manages an active team or project in each organization where the setting is `false`.
 *
 * Blocks (403) otherwise. A malformed `organizationId` gets 400. An organization the request names that
 * does not exist in the tenant carries no setting, so the route's own validation answers as before.
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
 * @throws ForbiddenException when there is no tenant context (the tenant guards run before this one).
 */
export async function canViewTrackedData(
	dataSource: DataSource,
	requestedOrganizationIds: unknown[] = []
): Promise<boolean> {
	// Admin / Super Admin with CHANGE_SELECTED_EMPLOYEE
	if (RequestContext.hasPermission(PermissionsEnum.CHANGE_SELECTED_EMPLOYEE)) {
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

	// Who the caller is as an employee, and in which organizations their tracked data lives. Those
	// organizations' settings apply even when a route reads by record id or scopes by a field this guard
	// does not see.
	const employeeRepository = dataSource.getRepository('Employee');
	const tokenEmployeeId: ID = RequestContext.currentUser()?.employeeId;
	let employeeIds: ID[] = [];
	let ownOrganizationIds: ID[] = [];

	if (tokenEmployeeId) {
		employeeIds = [tokenEmployeeId];
		// JwtStrategy validates the token's organization against the employee record, so it needs no lookup
		const tokenOrganizationId: ID = RequestContext.currentOrganizationId();
		if (tokenOrganizationId) {
			ownOrganizationIds = [tokenOrganizationId];
		} else {
			const employee = await employeeRepository.findOne({
				where: { id: tokenEmployeeId, tenantId },
				select: { id: true, organizationId: true }
			});
			ownOrganizationIds = [employee?.organizationId];
		}
	} else {
		// The token carries no employee claim, but it is minted per organization: a user who is an employee
		// elsewhere in the tenant can hold one (POST /auth/switch-organization issues it for an organization
		// where they have no employee record). Ask the database instead of exempting on the claim alone.
		const userId = RequestContext.currentUserId();
		// A null `userId` would be dropped into `IS NULL` by TypeORM rather than matching nothing
		const employees = userId
			? await employeeRepository.find({
					where: { userId, tenantId },
					select: { id: true, organizationId: true }
				})
			: [];
		if (!employees.length) {
			// Really no employee record: no tracked data of their own, role-based access applies unchanged
			return true;
		}
		employeeIds = employees.map((employee) => employee.id);
		ownOrganizationIds = employees.map((employee) => employee.organizationId);
	}

	const organizationIds: ID[] = [...new Set<ID>([...ownOrganizationIds, ...requested].filter(Boolean))];
	if (!organizationIds.length) {
		// No organization to apply a setting to; the route's own scoping and validation answer as before
		return true;
	}

	const organizations = await dataSource.getRepository('Organization').find({
		where: { id: In(organizationIds), tenantId },
		select: { id: true, allowEmployeeToSeeTrackedData: true }
	});

	for (const organization of organizations) {
		// The column is NOT NULL DEFAULT true; only an explicit false (0 from a raw tinyint) hides data
		const allowed = organization['allowEmployeeToSeeTrackedData'];
		if (allowed !== false && allowed !== 0) {
			continue;
		}
		// Setting is off: managers of a team or project in this organization keep their access
		if (!(await isManagerInOrganization(dataSource, employeeIds, organization.id, tenantId))) {
			return false;
		}
	}

	return true;
}

/**
 * Whether the employee is an active manager of any team or project in the organization.
 *
 * A team membership counts as managing when `isManager` is set or when the member holds the MANAGER role:
 * the team flows write the role (`OrganizationTeamService.create`) while the flag stays at its default, so
 * checking only the flag would miss most team managers.
 */
async function isManagerInOrganization(
	dataSource: DataSource,
	employeeIds: ID[],
	organizationId: ID,
	tenantId: ID
): Promise<boolean> {
	const membership = {
		employeeId: In(employeeIds),
		organizationId,
		tenantId,
		isActive: true,
		isArchived: false
	};
	const teamEmployeeRepository = dataSource.getRepository('OrganizationTeamEmployee');

	if (await teamEmployeeRepository.existsBy({ ...membership, isManager: true })) {
		return true;
	}
	if (await teamEmployeeRepository.existsBy({ ...membership, role: { name: RolesEnum.MANAGER } })) {
		return true;
	}
	return await dataSource.getRepository('OrganizationProjectEmployee').existsBy({ ...membership, isManager: true });
}
