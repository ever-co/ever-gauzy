import { ID } from '@gauzy/contracts';
import { BaseQueryDTO } from '@gauzy/core';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

/**
 * DTO for assigning users to plugin installations
 */
export class AssignPluginUsersDTO {
	@ApiProperty({
		description: 'Array of user IDs to assign to the plugin installation',
		type: [String],
		example: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001']
	})
	@IsArray()
	@IsUUID('4', { each: true, message: 'Each userId must be a valid UUID (version 4)' })
	@IsNotEmpty({ message: 'userIds array cannot be empty' })
	userIds: ID[];

	@ApiPropertyOptional({
		description: 'Optional reason for the assignment',
		type: String,
		example: 'Team members need access to this plugin for project work'
	})
	@IsOptional()
	reason?: string;
}

/**
 * DTO for unassigning users from plugin installations
 */
export class UnassignPluginUsersDTO {
	@ApiProperty({
		description: 'Array of user IDs to unassign from the plugin installation',
		type: [String],
		example: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001']
	})
	@IsArray()
	@IsUUID('4', { each: true, message: 'Each userId must be a valid UUID (version 4)' })
	@IsNotEmpty({ message: 'userIds array cannot be empty' })
	userIds: ID[];

	@ApiPropertyOptional({
		description: 'Optional reason for the unassignment',
		type: String,
		example: 'Users no longer need access to this plugin'
	})
	@IsOptional()
	reason?: string;
}

/**
 * DTO for querying plugin user assignments with pagination support
 * Extends BaseQueryDTO to inherit standard query capabilities (take, skip, where, relations, etc.)
 */
export class PluginUserAssignmentQueryDTO extends BaseQueryDTO {
	@ApiPropertyOptional({
		description: 'Plugin installation ID to filter by',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@IsOptional()
	@IsUUID('4', { message: 'pluginInstallationId must be a valid UUID (version 4)' })
	pluginInstallationId?: ID;

	@ApiPropertyOptional({
		description: 'User ID to filter by',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@IsOptional()
	@IsUUID('4', { message: 'userId must be a valid UUID (version 4)' })
	userId?: ID;

	@ApiPropertyOptional({
		description: 'Plugin ID to filter by',
		type: String,
		example: '550e8400-e29b-41d4-a716-446655440000'
	})
	@IsOptional()
	@IsUUID('4', { message: 'pluginId must be a valid UUID (version 4)' })
	pluginId?: ID;
}

/**
 * DTO for bulk plugin user assignment operations
 */
export class BulkPluginUserAssignmentDTO {
	@ApiProperty({
		description: 'Array of plugin installation IDs',
		type: [String],
		example: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001']
	})
	@IsArray()
	@IsUUID('4', { each: true, message: 'Each pluginInstallationId must be a valid UUID (version 4)' })
	@IsNotEmpty({ message: 'pluginInstallationIds array cannot be empty' })
	pluginInstallationIds: ID[];

	@ApiProperty({
		description: 'Array of user IDs to assign to all specified plugin installations',
		type: [String],
		example: ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001']
	})
	@IsArray()
	@IsUUID('4', { each: true, message: 'Each userId must be a valid UUID (version 4)' })
	@IsNotEmpty({ message: 'userIds array cannot be empty' })
	userIds: ID[];

	@ApiPropertyOptional({
		description: 'Optional reason for the bulk assignment',
		type: String,
		example: 'Department-wide plugin access grant'
	})
	@IsOptional()
	reason?: string;
}
