import { IOrganization, IProductCategoryTranslatable, IProductCreateInput, IProductOptionGroupTranslatable, IProductOptionTranslatable, IProductTranslation, IProductTypeTranslatable, ITenant } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, IsString } from "class-validator";

export class CreateProductDTO implements IProductCreateInput {

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly name: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly description: string;

    @ApiProperty({ type: () => Boolean })
    @IsOptional()
    readonly enabled: boolean;

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsString()
    readonly code: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly imageUrl: string;

    @ApiProperty({ type: () => Object })
    @IsObject()
    @IsNotEmptyObject()
    readonly type?: IProductTypeTranslatable;

    @ApiProperty({ type: () => Object })
    @IsObject()
    @IsNotEmptyObject()
    readonly category?: IProductCategoryTranslatable;

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly optionGroupUpdateInputs?: IProductOptionGroupTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly optionGroupCreateInputs?: IProductOptionGroupTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly optionGroupDeleteInputs?: IProductOptionGroupTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly optionDeleteInputs?: IProductOptionTranslatable[];

    @ApiProperty({ type: () => Object })
    @IsOptional()
    @IsArray()
    readonly translations: IProductTranslation[];

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly language?: string;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly organizationId?: string;

    @ApiProperty({ type: () => Object })
    @IsObject()
    @IsOptional()
    readonly organization?: IOrganization;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly tenantId?: string;

    @ApiProperty({ type: () => Object })
    @IsObject()
    @IsOptional()
    readonly tenant?: ITenant;

    @ApiProperty({ type: () => String })
    @IsOptional()
    @IsString()
    readonly id?: string;

    @ApiProperty({ type: () => Date })
    @IsOptional()
    readonly createdAt?: Date;

    @ApiProperty({ type: () => Date })
    @IsOptional()
    readonly updatedAt?: Date;

}