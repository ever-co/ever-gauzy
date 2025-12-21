import { ID } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class PluginTenantApprovalDTO {
	@ApiProperty({
		type: String,
		description: 'Plugin tenant ID to approve/reject'
	})
	@IsNotEmpty()
	@IsUUID()
	pluginTenantId: ID;

	@ApiProperty({
		type: Boolean,
		description: 'Whether to approve (true) or reject (false) the plugin'
	})
	@IsNotEmpty()
	@IsBoolean()
	approved: boolean;

	@ApiPropertyOptional({
		type: String,
		description: 'Notes or comments for the approval/rejection'
	})
	@IsOptional()
	@IsString()
	notes?: string;

	@ApiPropertyOptional({
		type: Boolean,
		description: 'Whether to enable the plugin immediately upon approval',
		default: false
	})
	@IsOptional()
	@IsBoolean()
	enableImmediately?: boolean;
}
