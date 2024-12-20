import { IImageAsset, IProduct, IProductCategoryTranslatable, IProductTypeTranslatable, IProductVariant, ITag } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";

export abstract class ProductDTO implements IProduct {

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly name: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly description: string;

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly enabled: boolean;

    @ApiPropertyOptional({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly code: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly imageUrl: string;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly featuredImage: IImageAsset;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly variants: IProductVariant[];

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly productTypeId: string;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    @IsString()
    readonly productCategoryId: string;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly productType: IProductTypeTranslatable;

    @ApiPropertyOptional({ type: () => Object })
    @IsOptional()
    readonly productCategory: IProductCategoryTranslatable;

    @ApiPropertyOptional({ type: () => Object, isArray: true })
    @IsOptional()
    readonly tags: ITag[];
}