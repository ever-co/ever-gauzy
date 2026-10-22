import { ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	CheckUserPluginAccessQuery,
	GetAllPluginUserAssignmentsQuery,
	GetPluginUserAssignmentsQuery,
	GetUserPluginAssignmentsQuery
} from '../../application';
import { IPluginTenant } from '../../shared';

/**
 * Plugin User Assignment Controller
 * Handles user assignment operations for specific plugins
 *
 * The three controllers of this file used to state no guard at all, so any authenticated member of the tenant
 * could list, assign and unassign the users of any plugin. Listing who may use a plugin now states
 * `PLUGIN_ASSIGN_ACCESS` or `PLUGIN_CONFIGURE` (the grant `subscription/access/assign` and `/revoke` already
 * require); reading one user's assignments or access states `PLUGIN_VIEW`, as `subscription/access/check` does.
 *
 * It used to also serve `POST` and `DELETE` on this path, to assign and unassign users. Both handed the plugin id
 * to a service that expects a plugin-tenant id, so they answered 404 for any real plugin; and that service
 * assigned nobody: it only moved the plugin-tenant's `currentActiveUsers` counter, so handed a plugin-tenant id in
 * the plugin's place they let a caller drift the quota without assigning anyone. Nothing calls them: the apps
 * assign and revoke through `plugins/:id/subscription/access/*` and manage the plugin-tenant's users through
 * `POST /plugin-tenants/:id/users`, which persists the allowed and denied users and their child subscriptions. The
 * two routes were removed rather than pointed at that flow, which would give them its subscription side effects.
 */
@ApiTags('Plugins - User Assignment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugins/:pluginId/users')
export class PluginUserAssignmentController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Get all users assigned to a specific plugin
	 */
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS, PermissionsEnum.PLUGIN_CONFIGURE)
	@Get()
	@ApiOperation({
		summary: 'Get users assigned to a plugin',
		description: 'Retrieve all users assigned to a specific plugin.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiQuery({ name: 'skip', description: 'Number of records to skip', required: false, type: 'number' })
	@ApiQuery({ name: 'take', description: 'Number of records to take', required: false, type: 'number' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin user assignments'
	})
	async getPluginUserAssignments(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Query('skip') skip?: number,
		@Query('take') take?: number
	): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		return this.queryBus.execute(new GetPluginUserAssignmentsQuery(pluginId, tenantId, organizationId, skip, take));
	}
}

/**
 * User Plugin Assignment Controller
 * Handles plugin assignment operations for specific users
 */
@ApiTags('Users - Plugin Assignment')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('users/:userId/plugins')
export class UserPluginAssignmentController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Get all plugins assigned to a specific user
	 */
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get()
	@ApiOperation({
		summary: 'Get plugins assigned to a user',
		description: 'Retrieve all plugins assigned to a specific user.'
	})
	@ApiParam({ name: 'userId', description: 'User ID', type: 'string', format: 'uuid' })
	@ApiQuery({ name: 'skip', description: 'Number of records to skip', required: false, type: 'number' })
	@ApiQuery({ name: 'take', description: 'Number of records to take', required: false, type: 'number' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved user plugin assignments'
	})
	async getUserPluginAssignments(
		@Param('userId', UUIDValidationPipe) userId: ID,
		@Query('skip') skip?: number,
		@Query('take') take?: number
	): Promise<IPagination<IPluginTenant>> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		return this.queryBus.execute(new GetUserPluginAssignmentsQuery(userId, tenantId, organizationId, skip, take));
	}

	/**
	 * Check if a user has access to a specific plugin
	 */
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get(':pluginId/access')
	@ApiOperation({
		summary: 'Check user plugin access',
		description: 'Check if a user has access to a specific plugin.'
	})
	@ApiParam({ name: 'userId', description: 'User ID', type: 'string', format: 'uuid' })
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully checked user plugin access'
	})
	async checkUserPluginAccess(
		@Param('userId', UUIDValidationPipe) userId: ID,
		@Param('pluginId', UUIDValidationPipe) pluginId: ID
	): Promise<{ hasAccess: boolean }> {
		const organizationId = RequestContext.currentOrganizationId();
		const tenantId = RequestContext.currentTenantId();
		return this.queryBus.execute(new CheckUserPluginAccessQuery(pluginId, userId, tenantId, organizationId));
	}
}

/**
 * Plugin User Assignment Management Controller
 * Handles general management operations for plugin user assignments
 */
@ApiTags('Plugins - User Assignment Management')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('plugin-user-assignments')
export class PluginUserAssignmentManagementController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Get all plugin user assignments
	 */
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS, PermissionsEnum.PLUGIN_CONFIGURE)
	@Get()
	@ApiOperation({
		summary: 'Get all plugin user assignments',
		description: 'Retrieve all plugin user assignments.'
	})
	@ApiQuery({ name: 'skip', description: 'Number of records to skip', required: false, type: 'number' })
	@ApiQuery({ name: 'take', description: 'Number of records to take', required: false, type: 'number' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved all plugin user assignments'
	})
	async getAllPluginUserAssignments(@Query('skip') skip?: number, @Query('take') take?: number): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		return this.queryBus.execute(new GetAllPluginUserAssignmentsQuery(tenantId, organizationId, skip, take));
	}
}
