import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional } from "class-validator";
import { Product, ProductCategoryTranslation } from "./../../core/entities/internal";
import { TranslatableBaseDTO } from "./../../core/dto";

export class ProductCategoryDTO extends TranslatableBaseDTO<ProductCategoryTranslation[]> {
    
    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly imageUrl: string;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    readonly products: Product[];
}