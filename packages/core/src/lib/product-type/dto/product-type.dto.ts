import { ProductTypesIconsEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { Product, ProductTypeTranslation } from "./../../core/entities/internal";
import { TranslatableBaseDTO } from "./../../core/dto";

export class ProductTypeDTO extends TranslatableBaseDTO<ProductTypeTranslation[]> {
    
    @ApiPropertyOptional({ type: () => String, enum: ProductTypesIconsEnum })
    @IsOptional()
    @IsEnum(ProductTypesIconsEnum)
    readonly icon: ProductTypesIconsEnum;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    readonly products: Product[];
}