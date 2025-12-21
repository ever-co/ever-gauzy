import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO for assigning users to a plugin
 */
export class AssignPluginUsersDTO {
	@ApiProperty({ type: [String], description: 'Array of user IDs to assign to the plugin' })
	@IsArray({ message: 'userIds must be an array' })
	@IsUUID('4', { each: true, message: 'Each userId must be a valid UUID' })
	@IsNotEmpty({ message: 'At least one user ID is required' })
	userIds: string[];

	@ApiPropertyOptional({ type: String, description: 'Optional reason for the assignment' })
	@IsOptional()
	@IsString({ message: 'Reason must be a string' })
	reason?: string;
}

/**
 * DTO for unassigning users from a plugin
 */
export class UnassignPluginUsersDTO {
	@ApiProperty({ type: [String], description: 'Array of user IDs to unassign from the plugin' })
	@IsArray({ message: 'userIds must be an array' })
	@IsUUID('4', { each: true, message: 'Each userId must be a valid UUID' })
	@IsNotEmpty({ message: 'At least one user ID is required' })
	userIds: string[];

	@ApiPropertyOptional({ type: String, description: 'Optional reason for the unassignment' })
	@IsOptional()
	@IsString({ message: 'Reason must be a string' })
	reason?: string;
}

/**
 * DTO for checking plugin user access
 */
export class CheckPluginUserAccessDTO {
	@ApiProperty({ type: String, description: 'Plugin ID to check access for' })
	@IsUUID('4', { message: 'Plugin ID must be a valid UUID' })
	@IsNotEmpty({ message: 'Plugin ID is required' })
	pluginId: string;

	@ApiPropertyOptional({ type: String, description: 'User ID to check access for' })
	@IsOptional()
	@IsUUID('4', { message: 'User ID must be a valid UUID' })
	userId?: string;
}

/**
 * Response DTO for plugin user access check
 */
export class PluginUserAccessResponseDTO {
	@ApiProperty({ type: Boolean, description: 'Whether the user has access to the plugin' })
	hasAccess: boolean;

	@ApiProperty({ type: String, description: 'Access level', required: false })
	accessLevel?: string;

	@ApiPropertyOptional({ type: Object, description: 'Assignment details if available' })
	assignment?: any;
}
