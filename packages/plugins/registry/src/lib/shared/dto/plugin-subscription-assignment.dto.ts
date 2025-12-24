import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * DTO for assigning plugin subscription to users
 */
export class AssignPluginSubscriptionDTO {
	@ApiProperty({ type: [String], description: 'Array of user IDs to assign the plugin subscription to' })
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
 * DTO for revoking plugin subscription assignment from users
 */
export class RevokePluginSubscriptionAssignmentDTO {
	@ApiProperty({ type: [String], description: 'Array of user IDs to revoke plugin subscription from' })
	@IsArray({ message: 'userIds must be an array' })
	@IsUUID('4', { each: true, message: 'Each userId must be a valid UUID' })
	@IsNotEmpty({ message: 'At least one user ID is required' })
	userIds: string[];

	@ApiPropertyOptional({ type: String, description: 'Optional reason for the revocation' })
	@IsOptional()
	@IsString({ message: 'Revocation reason must be a string' })
	revocationReason?: string;
}

/**
 * DTO for checking plugin subscription access
 */
export class CheckPluginSubscriptionAccessDTO {
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
 * Response DTO for subscription access check
 */
export class PluginSubscriptionAccessResponseDTO {
	@ApiProperty({ type: Boolean, description: 'Whether the user has access to the plugin' })
	hasAccess: boolean;

	@ApiProperty({ type: String, description: 'Access level/scope', required: false })
	accessLevel: string | null;

	@ApiProperty({ type: Boolean, description: 'Whether the user can assign this plugin to others' })
	canAssign: boolean;

	@ApiProperty({ type: Boolean, description: 'Whether the plugin requires a subscription' })
	requiresSubscription: boolean;

	@ApiProperty({ type: Boolean, description: 'Whether the user can activate the plugin' })
	canActivate: boolean;

	@ApiPropertyOptional({ type: Object, description: 'Subscription details if available' })
	subscription?: any;
}
