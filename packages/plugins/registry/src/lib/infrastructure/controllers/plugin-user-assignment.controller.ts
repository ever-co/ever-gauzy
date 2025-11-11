import { ID } from '@gauzy/contracts';
import { UUIDValidationPipe } from '@gauzy/core';
import { Body, Controller, Delete, Get, HttpStatus, Param, Post, ValidationPipe } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
	AssignUsersToPluginCommand,
	UnassignUsersFromPluginCommand
} from '../../application/commands/plugin-user-assignment.commands';
import {
	CheckUserPluginAccessQuery,
	GetPluginUserAssignmentsQuery,
	GetUserPluginAssignmentsQuery
} from '../../application/queries/plugin-user-assignment.queries';
import { AssignPluginUsersDTO, UnassignPluginUsersDTO } from '../../shared/dto/plugin-user-assignment.dto';

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
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved plugin user assignments'
	})
	async getPluginUserAssignments(@Param('pluginId', UUIDValidationPipe) pluginId: ID): Promise<any> {
		// TODO: Get tenantId and organizationId from request context
		return this.queryBus.execute(new GetPluginUserAssignmentsQuery(pluginId, null, null));
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
		// TODO: Get tenantId and organizationId from request context
		return this.commandBus.execute(
			new AssignUsersToPluginCommand(pluginId, assignDto.userIds, null, null, assignDto.reason)
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
		// TODO: Get tenantId and organizationId from request context
		return this.commandBus.execute(
			new UnassignUsersFromPluginCommand(pluginId, unassignDto.userIds, null, null, unassignDto.reason)
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
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved user plugin assignments'
	})
	async getUserPluginAssignments(@Param('userId', UUIDValidationPipe) userId: ID): Promise<any> {
		// TODO: Get tenantId and organizationId from request context
		return this.queryBus.execute(new GetUserPluginAssignmentsQuery(userId, null, null));
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
		// TODO: Get tenantId and organizationId from request context
		return this.queryBus.execute(new CheckUserPluginAccessQuery(pluginId, userId, null, null));
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
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved all plugin user assignments'
	})
	async getAllPluginUserAssignments(): Promise<any> {
		// TODO: Get tenantId and organizationId from request context
		// TODO: Implement query
		return {
			items: [],
			total: 0
		};
	}
}
