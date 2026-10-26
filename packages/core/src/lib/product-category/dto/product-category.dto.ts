import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { ID, IImageAsset } from "@gauzy/contracts";
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

    /**
     * The parent to file the category under, by identifier — the member both surfaces name the tree
     * by. Omitted, a create files a root and an edit leaves the parent as it is; `null` on an edit makes
     * the category a root. The service refuses a parent that is not readable in the caller's
     * organization and, on an edit, one inside the category's own subtree.
     */
    @ApiPropertyOptional({ type: () => String, nullable: true })
    @IsOptional()
    @IsUUID()
    readonly parentId?: ID | null;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    readonly products: Product[];
}
