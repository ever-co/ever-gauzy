import { LanguagesEnum } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsOptional } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

export class ProductTypeTranslationDTO extends TenantOrganizationBaseDTO {
    
    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly description: string;

    @ApiProperty({ type: () => String, enum: LanguagesEnum })
	@IsEnum(LanguagesEnum)
	readonly languageCode: LanguagesEnum;
}