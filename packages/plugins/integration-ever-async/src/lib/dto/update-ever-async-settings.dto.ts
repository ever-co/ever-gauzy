import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import { ConfigureEverAsyncIntegrationDto } from './configure-ever-async-integration.dto';

export class UpdateEverAsyncSettingsDto extends PartialType(ConfigureEverAsyncIntegrationDto, {
	skipNullProperties: false
}) {
	@ApiPropertyOptional()
	@ValidateIf((_object, value) => value !== undefined)
	@IsBoolean()
	readonly isEnabled?: boolean;
}
