import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsUrl, ValidateIf } from 'class-validator';
import { FileStorageProviderEnum, IWasabiFileStorageProviderConfig } from '@gauzy/contracts';
import { IsSecret } from '../../../core/decorators';
import { Trimmed } from '../../../shared/decorators/trim.decorator';

/**
 * Wasabi S3 FileStorage Provider Configuration DTO validation
 */
export class WasabiS3ProviderConfigDTO implements IWasabiFileStorageProviderConfig {
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly wasabi_aws_access_key_id: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly wasabi_aws_secret_access_key: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsString()
	@Trimmed()
	readonly wasabi_aws_bucket: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsString()
	@Trimmed()
	readonly wasabi_aws_default_region: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsString()
	@IsUrl()
	@Trimmed()
	readonly wasabi_aws_service_url: string;

	@ApiPropertyOptional({ type: () => Boolean })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsOptional()
	@IsBoolean()
	readonly wasabi_aws_force_path_style: boolean;
}
