import {
    IProductCategoryTranslatable,
    IProductCreateInput,
    IProductOptionGroupTranslatable,
    IProductOptionTranslatable,
    IProductTranslation,
    IProductTypeTranslatable
} from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import {
    IsArray,
    IsNotEmptyObject,
    IsObject,
    IsOptional,
    IsString
} from "class-validator";
import { ProductDTO } from "./product.dto";

export class CreateProductDTO extends ProductDTO implements IProductCreateInput {

    @ApiProperty({ type: () => Object })
    @IsObject()
    @IsNotEmptyObject()
    readonly type: IProductTypeTranslatable;

    @ApiProperty({ type: () => Object })
    @IsObject()
    @IsNotEmptyObject()
    readonly category: IProductCategoryTranslatable;

    @ApiProperty({ type: () => Object, isArray: true })
    @IsOptional()
    @IsArray()
    readonly optionGroupUpdateInputs: IProductOptionGroupTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly optionGroupCreateInputs: IProductOptionGroupTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly optionGroupDeleteInputs: IProductOptionGroupTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly optionDeleteInputs: IProductOptionTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly translations: IProductTranslation[];

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly language: string;
}