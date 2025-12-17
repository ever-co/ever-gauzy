import { ID, PluginScope } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class PluginTenantQueryDTO {
	@ApiPropertyOptional({ type: () => String, description: 'Plugin ID to filter by' })
	@IsOptional()
	@IsUUID()
	pluginId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Tenant ID to filter by' })
	@IsOptional()
	@IsUUID()
	tenantId?: ID;

	@ApiPropertyOptional({ type: () => String, description: 'Organization ID to filter by' })
	@IsOptional()
	@IsUUID()
	organizationId?: ID;

	@ApiPropertyOptional({ type: Boolean, description: 'Filter by enabled status' })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	enabled?: boolean;

	@ApiPropertyOptional({ enum: PluginScope, description: 'Filter by scope' })
	@IsOptional()
	@IsEnum(PluginScope)
	scope?: PluginScope;

	@ApiPropertyOptional({ type: Boolean, description: 'Filter by mandatory status' })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	isMandatory?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Filter by data compliance status' })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	isDataCompliant?: boolean;

	@ApiPropertyOptional({ type: Boolean, description: 'Filter by approval status' })
	@IsOptional()
	@Type(() => Boolean)
	@IsBoolean()
	isApproved?: boolean;
}
