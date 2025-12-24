import { ID } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum PluginTenantBulkOperation {
	ENABLE = 'enable',
	DISABLE = 'disable',
	APPROVE = 'approve',
	REVOKE = 'revoke',
	DELETE = 'delete'
}

export class PluginTenantBulkOperationDTO {
	@ApiProperty({
		type: [String],
		description: 'Array of plugin tenant IDs to operate on'
	})
	@IsNotEmpty()
	@IsArray()
	@IsUUID(undefined, { each: true })
	pluginTenantIds: ID[];

	@ApiProperty({
		enum: PluginTenantBulkOperation,
		description: 'Operation to perform'
	})
	@IsNotEmpty()
	@IsEnum(PluginTenantBulkOperation)
	operation: PluginTenantBulkOperation;

	@ApiPropertyOptional({
		type: Object,
		description: 'Additional data for the operation'
	})
	@IsOptional()
	@Type(() => Object)
	data?: Record<string, any>;

	@ApiPropertyOptional({
		type: String,
		description: 'Notes or comments for the operation'
	})
	@IsOptional()
	@IsString()
	notes?: string;
}
