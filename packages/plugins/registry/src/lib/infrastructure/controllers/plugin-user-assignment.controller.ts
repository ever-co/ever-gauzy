import { ID, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, Permissions, TenantPermissionGuard, UUIDValidationPipe } from '@gauzy/core';
import {
	Body,
	Controller,
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
	PluginUserAssignmentQueryDTO,
	UnassignPluginUsersDTO
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
@Controller('/plugin-installations/:pluginInstallationId/users')
export class PluginUserAssignmentController {
	constructor(private readonly commandBus: CommandBus, private readonly queryBus: QueryBus) {}

	@ApiOperation({
		summary: 'Assign users to plugin installation',
		description:
			'Assigns users to a plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission. Only works for plugins purchased at organization or tenant scope.'
	})
	@ApiParam({
		name: 'pluginInstallationId',
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
	@Post('assign')
	public async assignUsers(
		@Param('pluginInstallationId', UUIDValidationPipe) pluginInstallationId: ID,
		@Body() assignDto: AssignPluginUsersDTO
	): Promise<PluginUserAssignment[]> {
		return await this.commandBus.execute(
			new AssignUsersToPluginCommand(pluginInstallationId, assignDto.userIds, assignDto.reason)
		);
	}

	@ApiOperation({
		summary: 'Unassign users from plugin installation',
		description: 'Removes user assignments from a plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiParam({
		name: 'pluginInstallationId',
		description: 'Unique identifier of the plugin installation',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Users unassigned successfully',
		type: [PluginUserAssignment]
	})
	@ApiResponse({
		status: HttpStatus.FORBIDDEN,
		description: 'Insufficient permissions'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No active assignments found for specified users'
	})
	@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
	@Permissions(PermissionsEnum.PLUGIN_ASSIGN_ACCESS)
	@Post('unassign')
	public async unassignUsers(
		@Param('pluginInstallationId', UUIDValidationPipe) pluginInstallationId: ID,
		@Body() unassignDto: UnassignPluginUsersDTO
	): Promise<PluginUserAssignment[]> {
		return await this.commandBus.execute(
			new UnassignUsersFromPluginCommand(pluginInstallationId, unassignDto.userIds, unassignDto.reason)
		);
	}

	@ApiOperation({
		summary: 'Get all user assignments for plugin installation',
		description:
			'Retrieves all user assignments for a specific plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiParam({
		name: 'pluginInstallationId',
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
		@Param('pluginInstallationId', UUIDValidationPipe) pluginInstallationId: ID,
		@Query('includeInactive') includeInactive?: boolean
	): Promise<PluginUserAssignment[]> {
		return await this.queryBus.execute(
			new GetPluginUserAssignmentsQuery(pluginInstallationId, includeInactive || false)
		);
	}

	@ApiOperation({
		summary: 'Check if user has access to plugin installation',
		description:
			'Checks if a specific user has access to the plugin installation. Requires PLUGIN_ASSIGN_ACCESS permission.'
	})
	@ApiParam({
		name: 'pluginInstallationId',
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
	@Get('check/:userId')
	public async checkUserAccess(
		@Param('pluginInstallationId', UUIDValidationPipe) pluginInstallationId: ID,
		@Param('userId', UUIDValidationPipe) userId: ID
	): Promise<{ hasAccess: boolean }> {
		const hasAccess = await this.queryBus.execute(new CheckUserPluginAccessQuery(pluginInstallationId, userId));
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
