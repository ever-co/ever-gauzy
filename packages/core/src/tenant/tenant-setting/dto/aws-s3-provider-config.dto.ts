import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, ValidateIf } from "class-validator";
import { FileStorageProviderEnum } from "@gauzy/contracts";
import { Transform, TransformFnParams } from "class-transformer";

/**
 * Aws S3 FileStorage Provider Configuration DTO validation
 */
export class AwsS3ProviderConfigDTO {
	
	@ApiProperty({ type: () => String })
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	readonly aws_access_key_id: string;

	@ApiProperty({ type: () => String })
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	readonly aws_secret_access_key: string;
	
	@ApiProperty({ type: () => String })
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	readonly aws_default_region: string;

	@ApiProperty({ type: () => String })
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	@IsOptional()
	@IsString()
	readonly aws_bucket: string;
}