import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { Transform, TransformFnParams } from "class-transformer";
import { IsEnum, IsNotEmpty } from "class-validator";
import { FileStorageProviderEnum } from "@gauzy/contracts";
import { AwsS3ProviderConfigDTO } from "./aws-s3-provider-config.dto";
import { WasabiS3ProviderConfigDTO } from "./wasabi-s3-provider-config.dto";
import { CloudinaryProviderConfigDTO } from "./cloudinary-provider-config.dto";
import { DigitalOceanS3ProviderConfigDTO } from './digitalocean-s3.provider-config.dto';

/**
 * Tenant Setting Save Request DTO validation
 */
export class CreateTenantSettingDTO extends IntersectionType(
	IntersectionType(WasabiS3ProviderConfigDTO, DigitalOceanS3ProviderConfigDTO),
	IntersectionType(AwsS3ProviderConfigDTO, CloudinaryProviderConfigDTO)
) {
	/**
	 * FileStorage Provider Configuration
	 */
	@ApiProperty({ enum: FileStorageProviderEnum })
	@IsNotEmpty()
	@IsEnum(FileStorageProviderEnum)
	@Transform((params: TransformFnParams) => params.value.trim().toUpperCase())
	readonly fileStorageProvider: FileStorageProviderEnum;
}
