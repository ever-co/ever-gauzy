import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { IImageAsset } from "@gauzy/contracts";
import { Product, ProductCategoryTranslation } from "./../../core/entities/internal";
import { TranslatableBaseDTO } from "./../../core/dto";

export class ProductCategoryDTO extends TranslatableBaseDTO<ProductCategoryTranslation[]> {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsUUID()
    readonly imageId?: IImageAsset['id'];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly imageUrl: string;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    readonly products: Product[];
}
