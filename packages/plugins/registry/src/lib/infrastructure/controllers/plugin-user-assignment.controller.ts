import { ID, IPagination } from '@gauzy/contracts';
import { RequestContext, UUIDValidationPipe } from '@gauzy/core';
import { Body, Controller, Delete, Get, HttpStatus, Param, Post, Query, ValidationPipe } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	AssignUsersToPluginCommand,
	CheckUserPluginAccessQuery,
	GetAllPluginUserAssignmentsQuery,
	GetPluginUserAssignmentsQuery,
	GetUserPluginAssignmentsQuery,
	UnassignUsersFromPluginCommand
} from '../../application';
import { AssignPluginUsersDTO, IPluginTenant, UnassignPluginUsersDTO } from '../../shared';

/**
 * Plugin User Assignment Controller
 * Handles user assignment operations for specific plugins
 */
@ApiTags('Plugins - User Assignment')
@Controller('plugins/:pluginId/users')
export class PluginUserAssignmentController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	/**
	 * Get all users assigned to a specific plugin
	 */
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

	/**
	 * Assign users to a plugin
	 */
	@Post()
	@ApiOperation({
		summary: 'Assign users to a plugin',
		description: 'Assign one or more users to a specific plugin.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: AssignPluginUsersDTO })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Successfully assigned users to plugin'
	})
	async assignUsersToPlugin(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Body(new ValidationPipe({ transform: true })) assignDto: AssignPluginUsersDTO
	): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		return this.commandBus.execute(
			new AssignUsersToPluginCommand(pluginId, assignDto.userIds, tenantId, organizationId, assignDto.reason)
		);
	}

	/**
	 * Unassign users from a plugin
	 */
	@Delete()
	@ApiOperation({
		summary: 'Unassign users from a plugin',
		description: 'Remove one or more users from a specific plugin.'
	})
	@ApiParam({ name: 'pluginId', description: 'Plugin ID', type: 'string', format: 'uuid' })
	@ApiBody({ type: UnassignPluginUsersDTO })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully unassigned users from plugin'
	})
	async unassignUsersFromPlugin(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Body(new ValidationPipe({ transform: true })) unassignDto: UnassignPluginUsersDTO
	): Promise<any> {
		const tenantId = RequestContext.currentTenantId();
		const organizationId = RequestContext.currentOrganizationId();
		return this.commandBus.execute(
			new UnassignUsersFromPluginCommand(
				pluginId,
				unassignDto.userIds,
				tenantId,
				organizationId,
				unassignDto.reason
			)
		);
	}
}

/**
 * User Plugin Assignment Controller
 * Handles plugin assignment operations for specific users
 */
@ApiTags('Users - Plugin Assignment')
@Controller('users/:userId/plugins')
export class UserPluginAssignmentController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Get all plugins assigned to a specific user
	 */
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
@Controller('plugin-user-assignments')
export class PluginUserAssignmentManagementController {
	constructor(private readonly queryBus: QueryBus) {}

	/**
	 * Get all plugin user assignments
	 */
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
