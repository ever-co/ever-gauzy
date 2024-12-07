import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, ValidateIf } from 'class-validator';
import { FileStorageProviderEnum, IS3FileStorageProviderConfig } from '@gauzy/contracts';
import { IsSecret } from '../../../core/decorators';
import { Trimmed } from '../../../shared/decorators/trim.decorator';

/**
 * Aws S3 FileStorage Provider Configuration DTO validation
 */
export class AwsS3ProviderConfigDTO implements IS3FileStorageProviderConfig {
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly aws_access_key_id: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	@IsSecret()
	@Trimmed()
	readonly aws_secret_access_key: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	readonly aws_default_region: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	@Trimmed()
	readonly aws_bucket: string;

	@ApiProperty({ type: () => Boolean })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsBoolean()
	readonly aws_force_path_style: boolean;
}
