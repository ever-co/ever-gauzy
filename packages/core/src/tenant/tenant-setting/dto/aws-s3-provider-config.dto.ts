import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, ValidateIf } from "class-validator";
import { FileStorageProviderEnum } from "@gauzy/contracts";

/**
 * Aws S3 FileStorage Provider Configuration DTO validation
 */
export class AwsS3ProviderConfigDTO {
	
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsNotEmpty()
	readonly aws_access_key_id: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsNotEmpty()
	readonly aws_secret_access_key: string;
	
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsNotEmpty()
	readonly aws_default_region: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsNotEmpty()
	readonly aws_bucket: string;
}