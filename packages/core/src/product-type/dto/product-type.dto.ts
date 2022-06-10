import { LanguagesEnum, ProductTypesIconsEnum, TranslatePropertyInput } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, ValidateNested } from "class-validator";
import { Product, ProductTypeTranslation } from "./../../core/entities/internal";
import { TenantOrganizationBaseDTO } from "./../../core/dto";
import { ProductTypeTranslationDTO } from "./product-type-translation.dto";

export class ProductTypeDTO extends TenantOrganizationBaseDTO {
    
    @ApiPropertyOptional({ type: () => String, enum: ProductTypesIconsEnum })
    @IsOptional()
    @IsEnum(ProductTypesIconsEnum)
    readonly icon: ProductTypesIconsEnum;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @ValidateNested({ each: true })
    @Type(() => ProductTypeTranslationDTO)
    readonly translations: ProductTypeTranslation[];

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    readonly products: Product[];

    @ApiPropertyOptional({ type: () => Function })
    @IsOptional()
    readonly translate: (language: LanguagesEnum) => string;

    @ApiPropertyOptional({ type: () => Function })
    @IsOptional()
    readonly translateNested: (language: LanguagesEnum, pros: TranslatePropertyInput[]) => any;
}