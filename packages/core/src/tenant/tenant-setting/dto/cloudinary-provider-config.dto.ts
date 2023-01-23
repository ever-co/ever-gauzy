import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, ValidateIf } from "class-validator";
import { FileStorageProviderEnum, ICloudinaryFileStorageProviderConfig } from "@gauzy/contracts";
import { Transform, TransformFnParams } from "class-transformer";
import { IsSecret } from "./../../../core/decorators";

/**
 * Cloudinary FileStorage Provider Configuration DTO validation
 */
export class CloudinaryProviderConfigDTO implements ICloudinaryFileStorageProviderConfig {

    @ApiProperty({ type: () => String })
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    @ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.CLOUDINARY)
    @IsNotEmpty()
    readonly cloudinary_cloud_name: string;

    @ApiProperty({ type: () => String })
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    @ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.CLOUDINARY)
    @IsNotEmpty()
    @IsSecret()
    readonly cloudinary_api_key: string;

    @ApiProperty({ type: () => String })
    @Transform((params: TransformFnParams) => params.value ? params.value.trim() : null)
    @ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.CLOUDINARY)
    @IsNotEmpty()
    @IsSecret()
    readonly cloudinary_api_secret: string;
}
