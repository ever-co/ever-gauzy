import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, ValidateIf } from "class-validator";
import { FileStorageProviderEnum } from "@gauzy/contracts";

/**
 * Tenant Setting Save Request DTO validation
 */
 export class CreateTenantSettingDTO {

	/**
	 * Local FileStorage Configuration
	 */
	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsEnum(FileStorageProviderEnum)
	readonly fileStorageProvider: FileStorageProviderEnum;

	/**
	 * S3 FileStorage Configuration
	 */
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
	readonly aws_default_region: string;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.S3)
	readonly aws_bucket: string;
}