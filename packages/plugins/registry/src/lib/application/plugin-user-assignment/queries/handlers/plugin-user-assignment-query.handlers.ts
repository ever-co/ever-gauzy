import { IPagination } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PluginTenantService, PluginUserAssignmentService } from '../../../../domain';
import { IPluginTenant } from '../../../../shared';
import {
	CheckUserPluginAccessQuery,
	GetAllPluginUserAssignmentsQuery,
	GetPluginUserAssignmentsQuery,
	GetUserPluginAssignmentsQuery
} from '../../queries/plugin-user-assignment.queries';

/**
 * Handler for getting plugin user assignments
 */
@QueryHandler(GetPluginUserAssignmentsQuery)
export class GetPluginUserAssignmentsQueryHandler implements IQueryHandler<GetPluginUserAssignmentsQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	async execute(query: GetPluginUserAssignmentsQuery): Promise<IPagination<IPluginTenant>> {
		const { pluginId, tenantId, organizationId, skip, take } = query;

		// Use context values if not provided
		const currentTenantId = tenantId || RequestContext.currentTenantId();
		const currentOrgId = organizationId || RequestContext.currentOrganizationId();

		if (!currentTenantId) {
			return {
				items: [],
				total: 0
			};
		}

		// Use PluginTenantService to find plugin tenants by plugin ID with pagination
		const result = await this.pluginTenantService.findByPluginId(
			pluginId,
			['plugin', 'allowedRoles', 'allowedUsers', 'deniedUsers', 'approvedBy'],
			skip,
			take
		);

		// Filter by tenant and organization
		const filteredTenants = result.items.filter((tenant) => {
			if (tenant.tenantId !== currentTenantId) {
				return false;
			}
			if (currentOrgId && tenant.organizationId !== currentOrgId) {
				return false;
			}
			return true;
		});

		return {
			items: filteredTenants,
			total: result.total
		};
	}
}

/**
 * Handler for getting user plugin assignments
 */
@QueryHandler(GetUserPluginAssignmentsQuery)
export class GetUserPluginAssignmentsQueryHandler implements IQueryHandler<GetUserPluginAssignmentsQuery> {
	constructor(
		private readonly userAssignmentService: PluginUserAssignmentService,
		private readonly pluginTenantService: PluginTenantService
	) {}

	async execute(query: GetUserPluginAssignmentsQuery): Promise<IPagination<IPluginTenant>> {
		const { userId, tenantId, organizationId, skip, take } = query;

		// Use context values if not provided
		const currentTenantId = tenantId || RequestContext.currentTenantId();
		const currentOrgId = organizationId || RequestContext.currentOrganizationId();
		const currentUserId = userId || RequestContext.currentUserId();

		if (!currentTenantId || !currentUserId) {
			return {
				items: [],
				total: 0
			};
		}

		// Get all plugin tenants for this tenant/organization using PluginTenantService with pagination
		const result = await this.pluginTenantService.findByTenantId(
			currentTenantId,
			currentOrgId,
			['plugin', 'allowedRoles', 'allowedUsers', 'deniedUsers'],
			skip,
			take
		);

		// Filter plugins the user has access to
		const accessiblePluginTenants: IPluginTenant[] = [];
		for (const pluginTenant of result.items) {
			const hasAccess = await this.userAssignmentService.hasUserAccessToPlugin(
				{ pluginTenantId: pluginTenant.id },
				currentUserId
			);

			if (hasAccess) {
				accessiblePluginTenants.push(pluginTenant);
			}
		}

		return {
			items: accessiblePluginTenants,
			total: result.total
		};
	}
}

/**
 * Handler for checking user plugin access
 */
@QueryHandler(CheckUserPluginAccessQuery)
export class CheckUserPluginAccessQueryHandler implements IQueryHandler<CheckUserPluginAccessQuery> {
	constructor(private readonly userAssignmentService: PluginUserAssignmentService) {}

	async execute(query: CheckUserPluginAccessQuery): Promise<{ hasAccess: boolean }> {
		const { pluginId, userId, tenantId, organizationId } = query;

		// Use context values if not provided
		const currentTenantId = tenantId || RequestContext.currentTenantId();
		const currentOrgId = organizationId || RequestContext.currentOrganizationId();
		const currentUserId = userId || RequestContext.currentUserId();

		if (!currentTenantId || !currentUserId) {
			return { hasAccess: false };
		}

		const hasAccess = await this.userAssignmentService.hasUserAccessToPlugin(
			{
				pluginId,
				tenantId: currentTenantId,
				organizationId: currentOrgId
			},
			currentUserId
		);

		return { hasAccess };
	}
}

/**
 * Handler for getting all plugin user assignments
 */
@QueryHandler(GetAllPluginUserAssignmentsQuery)
export class GetAllPluginUserAssignmentsQueryHandler implements IQueryHandler<GetAllPluginUserAssignmentsQuery> {
	constructor(private readonly pluginTenantService: PluginTenantService) {}

	async execute(query: GetAllPluginUserAssignmentsQuery): Promise<IPagination<IPluginTenant>> {
		const { tenantId, organizationId, skip, take } = query;

		// Use context values if not provided
		const currentTenantId = tenantId || RequestContext.currentTenantId();
		const currentOrgId = organizationId || RequestContext.currentOrganizationId();

		if (!currentTenantId) {
			return {
				items: [],
				total: 0
			};
		}

		// Use PluginTenantService to get all plugin tenants for this tenant/organization with pagination
		return this.pluginTenantService.findByTenantId(
			currentTenantId,
			currentOrgId,
			['plugin', 'allowedRoles', 'allowedUsers', 'deniedUsers', 'approvedBy'],
			skip,
			take
		);
	}
}
