import { PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, RequestContext, TenantPermissionGuard } from '@gauzy/core';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	AssignPluginSubscriptionUsersCommand,
	CheckUserSubscriptionAccessQuery,
	GetSubscriptionAccessQuery,
	RevokePluginSubscriptionUsersCommand
} from '../../application';
import {
	AssignPluginSubscriptionDTO,
	CheckPluginSubscriptionAccessDTO,
	PluginSubscriptionAccessResponseDTO,
	RevokePluginSubscriptionAssignmentDTO
} from '../../shared';

@ApiTags('Plugin Subscription Access')
@Controller('plugins/:pluginId/subscription/access')
export class PluginSubscriptionAccessController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Check if current user has access to the plugin
	 */
	@ApiOperation({
		summary: 'Check plugin subscription access',
		description: 'Validates if the current user has an active subscription to access the plugin'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Access check result',
		type: PluginSubscriptionAccessResponseDTO
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Get()
	async checkAccess(
		@Param('pluginId', ParseUUIDPipe) pluginId: string
	): Promise<PluginSubscriptionAccessResponseDTO> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		return await this.queryBus.execute(new GetSubscriptionAccessQuery(pluginId, tenantId, organizationId, userId));
	}

	/**
	 * Check if a specific user has access to the plugin
	 */
	@ApiOperation({
		summary: 'Check user plugin access',
		description: 'Validates if a specific user has access to the plugin'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Access check result',
		type: PluginSubscriptionAccessResponseDTO
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_VIEW)
	@Post('check')
	@HttpCode(HttpStatus.OK)
	async checkUserAccess(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Body() dto: CheckPluginSubscriptionAccessDTO
	): Promise<PluginSubscriptionAccessResponseDTO> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();

		return await this.queryBus.execute(
			new CheckUserSubscriptionAccessQuery(pluginId, dto.userId, tenantId, organizationId)
		);
	}

	/**
	 * Assign plugin subscription to users (for organization/tenant level subscriptions)
	 */
	@ApiOperation({
		summary: 'Assign plugin subscription to users',
		description:
			'Assigns a plugin to specific users when the organization or tenant owns an active subscription. This enables sharing organization/tenant-level subscriptions with team members.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Users successfully assigned to plugin subscription'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to assign subscriptions'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post('assign')
	@HttpCode(HttpStatus.CREATED)
	async assignUsers(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Body() dto: AssignPluginSubscriptionDTO
	): Promise<{ message: string; assignedUsers: number }> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		return await this.commandBus.execute(
			new AssignPluginSubscriptionUsersCommand(pluginId, dto, tenantId, organizationId, userId)
		);
	}

	/**
	 * Revoke plugin subscription assignment from users
	 */
	@ApiOperation({
		summary: 'Revoke plugin subscription from users',
		description: 'Removes plugin access from specific users at the organization/tenant level'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: String, format: 'uuid' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Users successfully removed from plugin subscription'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'User does not have permission to revoke subscriptions'
	})
	@UseGuards(TenantPermissionGuard, PermissionGuard)
	@Permissions(PermissionsEnum.PLUGIN_CONFIGURE)
	@Post('revoke')
	@HttpCode(HttpStatus.OK)
	async revokeUsers(
		@Param('pluginId', ParseUUIDPipe) pluginId: string,
		@Body() dto: RevokePluginSubscriptionAssignmentDTO
	): Promise<{ message: string; revokedUsers: number }> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		const userId = RequestContext.currentUserId();

		return await this.commandBus.execute(
			new RevokePluginSubscriptionUsersCommand(pluginId, dto, tenantId, organizationId, userId)
		);
	}
}
