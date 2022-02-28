import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsUrl, ValidateIf } from "class-validator";
import { FileStorageProviderEnum } from "@gauzy/contracts";

/**
 * Wasabi S3 FileStorage Provider Configuration DTO validation
 */
export class WasabiS3ProviderConfigDTO {
	
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsNotEmpty()
	readonly wasabi_aws_access_key_id: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsNotEmpty()
	readonly wasabi_aws_secret_access_key: string;
	
	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsNotEmpty()
	readonly wasabi_aws_default_region: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsNotEmpty()
	@IsUrl()
	readonly wasabi_aws_service_url: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.WASABI)
	@IsNotEmpty()
	readonly wasabi_aws_bucket: string;
}