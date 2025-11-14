import { ID } from '@gauzy/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';

export class PluginTenantConfigurationDTO {
	@ApiProperty({
		type: String,
		description: 'Plugin tenant ID'
	})
	@IsNotEmpty()
	@IsUUID()
	pluginTenantId: ID;

	@ApiPropertyOptional({
		type: Object,
		description: 'Configuration to merge/set'
	})
	@IsOptional()
	@IsObject()
	configuration?: Record<string, any>;

	@ApiPropertyOptional({
		type: Object,
		description: 'Preferences to merge/set'
	})
	@IsOptional()
	@IsObject()
	preferences?: Record<string, any>;
}
