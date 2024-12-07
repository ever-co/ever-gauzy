import { DiscountTaxTypeEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsNumber, IsEnum } from "class-validator";

export class TaxInvoiceDTO {
    @ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum })
    @IsOptional()
    @IsEnum(DiscountTaxTypeEnum)
    taxType: DiscountTaxTypeEnum;

    @ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum })
    @IsOptional()
    @IsEnum(DiscountTaxTypeEnum)
    tax2Type: DiscountTaxTypeEnum;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly tax: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly tax2: number;
}