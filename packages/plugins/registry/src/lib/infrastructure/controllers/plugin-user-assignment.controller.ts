import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import {
	Body,
	Controller,
	Delete,
	Get,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';

// Entities
import { PluginUserAssignment } from '../../domain/entities/plugin-user-assignment.entity';

// DTOs
import {
	AssignPluginUsersDTO,
	BulkPluginUserAssignmentDTO,
	PluginUserAssignmentQueryDTO
} from '../../shared/dto/plugin-user-assignment.dto';

// Commands
import {
	AssignUsersToPluginCommand,
	BulkAssignUsersToPluginsCommand,
	UnassignUsersFromPluginCommand
} from '../../application/commands/plugin-user-assignment.commands';

// Queries
import {
	CheckUserPluginAccessQuery,
	GetAllPluginUserAssignmentsQuery,
	GetPluginUserAssignmentsQuery,
	GetUserPluginAssignmentsQuery
} from '../../application/queries/plugin-user-assignment.queries';

@ApiTags('Plugin User Assignment')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugins/:pluginId/installations/:installationId/users')
export class PluginUserAssignmentController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	@ApiOperation({
		summary: 'Assign users to plugin installation',
		description:
			'Assigns users to a plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission. Only works for plugins purchased at organization or tenant scope.'
	})
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiParam({
		name: 'installationId',
		description: 'Unique identifier of the plugin installation',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Users assigned successfully',
		type: [PluginUserAssignment]
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions or plugin not purchased for organization/tenant scope'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid plugin installation ID or users already assigned'
	})
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Post()
	public async assignUsers(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('installationId', UUIDValidationPipe) installationId: ID,
		@Body() assignDto: AssignPluginUsersDTO
	): Promise<PluginUserAssignment[]> {
		return await this.commandBus.execute(
			new AssignUsersToPluginCommand(installationId, assignDto.userIds, assignDto.reason)
		);
	}

	@ApiOperation({
		summary: 'Unassign user from plugin installation',
		description: 'Removes a user assignment from a plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiParam({
		name: 'installationId',
		description: 'Unique identifier of the plugin installation',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiParam({
		name: 'userId',
		description: 'Unique identifier of the user to unassign',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440001'
	})
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'User unassigned successfully'
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No active assignment found for specified user'
	})
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Delete(':userId')
	public async unassignUser(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('installationId', UUIDValidationPipe) installationId: ID,
		@Param('userId', UUIDValidationPipe) userId: ID
	): Promise<void> {
		await this.commandBus.execute(
			new UnassignUsersFromPluginCommand(installationId, [userId], 'Individual user unassignment')
		);
	}

	@ApiOperation({
		summary: 'Get all user assignments for plugin installation',
		description:
			'Retrieves all user assignments for a specific plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiParam({
		name: 'installationId',
		description: 'Unique identifier of the plugin installation',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiQuery({
		name: 'includeInactive',
		required: false,
		description: 'Whether to include inactive assignments',
		type: Boolean,
		example: false
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'User assignments retrieved successfully',
		type: [PluginUserAssignment]
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions'
	})
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Get()
	public async getPluginUserAssignments(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('installationId', UUIDValidationPipe) installationId: ID,
		@Query('includeInactive') includeInactive?: boolean
	): Promise<PluginUserAssignment[]> {
		return await this.queryBus.execute(new GetPluginUserAssignmentsQuery(installationId, includeInactive || false));
	}

	@ApiOperation({
		summary: 'Check if user has access to plugin installation',
		description:
			'Checks if a specific user has access to the plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiParam({
		name: 'pluginId',
		description: 'Unique identifier of the plugin',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiParam({
		name: 'installationId',
		description: 'Unique identifier of the plugin installation',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiParam({
		name: 'userId',
		description: 'Unique identifier of the user',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440001'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'User access check completed',
		schema: {
			type: 'object',
			properties: {
				hasAccess: { type: 'boolean' }
			}
		}
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions'
	})
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Get(':userId/access')
	public async checkUserAccess(
		@Param('pluginId', UUIDValidationPipe) pluginId: ID,
		@Param('installationId', UUIDValidationPipe) installationId: ID,
		@Param('userId', UUIDValidationPipe) userId: ID
	): Promise<{ hasAccess: boolean }> {
		const hasAccess = await this.queryBus.execute(new CheckUserPluginAccessQuery(installationId, userId));
		return { hasAccess };
	}
}

@ApiTags('Plugin User Assignment')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/users/:userId/plugin-assignments')
export class UserPluginAssignmentController {
	constructor(private readonly queryBus: QueryBus) {}

	@ApiOperation({
		summary: 'Get all plugin assignments for user',
		description: 'Retrieves all plugin assignments for a specific user. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiParam({
		name: 'userId',
		description: 'Unique identifier of the user',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiQuery({
		name: 'includeInactive',
		required: false,
		description: 'Whether to include inactive assignments',
		type: Boolean,
		example: false
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin assignments retrieved successfully',
		type: [PluginUserAssignment]
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions'
	})
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Get()
	public async getUserPluginAssignments(
		@Param('userId', UUIDValidationPipe) userId: ID,
		@Query('includeInactive') includeInactive?: boolean
	): Promise<PluginUserAssignment[]> {
		return await this.queryBus.execute(new GetUserPluginAssignmentsQuery(userId, includeInactive || false));
	}
}

@ApiTags('Plugin User Assignment')
@ApiBearerAuth('Bearer')
@ApiSecurity('api_key')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/plugin-user-assignments')
export class PluginUserAssignmentManagementController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	@ApiOperation({
		summary: 'Bulk assign users to multiple plugin installations',
		description: 'Assigns users to multiple plugin installations in bulk. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Bulk assignment completed successfully',
		type: [PluginUserAssignment]
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input data'
	})
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Post('bulk-assign')
	public async bulkAssignUsers(@Body() bulkAssignDto: BulkPluginUserAssignmentDTO): Promise<PluginUserAssignment[]> {
		return await this.commandBus.execute(
			new BulkAssignUsersToPluginsCommand(
				bulkAssignDto.pluginInstallationIds,
				bulkAssignDto.userIds,
				bulkAssignDto.reason
			)
		);
	}

	@ApiOperation({
		summary: 'Get all plugin user assignments',
		description:
			'Retrieves all plugin user assignments with optional filters. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Plugin user assignments retrieved successfully',
		type: [PluginUserAssignment]
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions'
	})
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Get()
	public async getAllPluginUserAssignments(
		@Query() queryDto: PluginUserAssignmentQueryDTO
	): Promise<PluginUserAssignment[]> {
		const filters = {
			pluginId: queryDto.pluginId,
			userId: queryDto.userId,
			pluginInstallationId: queryDto.pluginInstallationId
		};

		// Remove undefined values
		Object.keys(filters).forEach((key) => {
			if (filters[key] === undefined) {
				delete filters[key];
			}
		});

		return await this.queryBus.execute(
			new GetAllPluginUserAssignmentsQuery(Object.keys(filters).length > 0 ? filters : undefined)
		);
	}
}
