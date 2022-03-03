import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, ValidateIf } from "class-validator";
import { FileStorageProviderEnum } from "@gauzy/contracts";
import { Transform, TransformFnParams } from "class-transformer";

/**
 * Wasabi S3 FileStorage Provider Configuration DTO validation
 */
export class WasabiS3ProviderConfigDTO {
	
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsOptional()
	@IsString()
	readonly wasabi_aws_access_key_id: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsOptional()
	@IsString()
	readonly wasabi_aws_secret_access_key: string;

	@ApiProperty({ type: () => String })
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsOptional()
	@IsString()
	readonly wasabi_aws_bucket: string;
	
	@ApiProperty({ type: () => String })
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsOptional()
	@IsString()
	readonly wasabi_aws_default_region: string;

	@ApiProperty({ type: () => String })
	@Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsOptional()
	@IsString()
	@IsUrl()
	readonly wasabi_aws_service_url: string;
}