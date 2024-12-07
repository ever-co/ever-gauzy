import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, ValidateIf } from "class-validator";
import { FileStorageProviderEnum, ICloudinaryFileStorageProviderConfig } from "@gauzy/contracts";
import { IsSecret } from "../../../core/decorators";
import { Trimmed } from '../../../shared/decorators/trim.decorator';

/**
 * Cloudinary FileStorage Provider Configuration DTO validation
 */
export class CloudinaryProviderConfigDTO implements ICloudinaryFileStorageProviderConfig {

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.CLOUDINARY)
    @IsNotEmpty()
    @Trimmed()
    readonly cloudinary_cloud_name: string;

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.CLOUDINARY)
    @IsNotEmpty()
    @IsSecret()
    @Trimmed()
    readonly cloudinary_api_key: string;

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.CLOUDINARY)
    @IsNotEmpty()
    @IsSecret()
    @Trimmed()
    readonly cloudinary_api_secret: string;

    @ApiProperty({ type: () => String })
    @ValidateIf((it) => it.fileStorageProvider === FileStorageProviderEnum.CLOUDINARY)
    @IsOptional()
    readonly cloudinary_api_secure: string;
}
