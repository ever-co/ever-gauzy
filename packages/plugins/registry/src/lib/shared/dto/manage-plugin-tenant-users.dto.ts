import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Operation type for managing plugin tenant users
 */
export enum PluginTenantUserOperationType {
	ALLOW = 'allow',
	DENY = 'deny',
	REMOVE_ALLOWED = 'remove-allowed',
	REMOVE_DENIED = 'remove-denied'
}

/**
 * DTO for managing plugin tenant users (allow, deny, remove)
 */
export class ManagePluginTenantUsersDTO {
	@ApiProperty({
		type: [String],
		description: 'Array of user IDs to manage'
	})
	@IsArray({ message: 'userIds must be an array' })
	@IsUUID('4', { each: true, message: 'Each userId must be a valid UUID' })
	@IsNotEmpty({ message: 'At least one user ID is required' })
	userIds: string[];

	@ApiProperty({
		enum: PluginTenantUserOperationType,
		description: 'Operation to perform: allow, deny, remove-allowed, remove-denied'
	})
	@IsEnum(PluginTenantUserOperationType, {
		message: 'Operation must be one of: allow, deny, remove-allowed, remove-denied'
	})
	@IsNotEmpty({ message: 'Operation is required' })
	operation: PluginTenantUserOperationType;

	@ApiPropertyOptional({
		type: String,
		description: 'Optional reason for the operation'
	})
	@IsOptional()
	@IsString({ message: 'Reason must be a string' })
	reason?: string;
}

/**
 * Query DTO for getting plugin tenant users
 */
export class GetPluginTenantUsersQueryDTO {
	@ApiPropertyOptional({
		enum: ['allowed', 'denied', 'all'],
		description: 'Type of users to retrieve',
		default: 'all'
	})
	@IsOptional()
	@IsEnum(['allowed', 'denied', 'all'])
	type?: 'allowed' | 'denied' | 'all';

	@ApiPropertyOptional({
		type: Number,
		description: 'Number of records to skip'
	})
	@IsOptional()
	skip?: number;

	@ApiPropertyOptional({
		type: Number,
		description: 'Number of records to take'
	})
	@IsOptional()
	take?: number;

	@ApiPropertyOptional({
		type: String,
		description: 'Search term for filtering users by name or email'
	})
	@IsOptional()
	@IsString()
	searchTerm?: string;
}
