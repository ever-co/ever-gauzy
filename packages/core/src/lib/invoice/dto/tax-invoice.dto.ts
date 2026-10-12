import { DiscountTaxTypeEnum, TaxCalculationTypeEnum } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
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

    /** Declared because create/update validate with `whitelist: true`, which strips undeclared fields. */
    @ApiPropertyOptional({ type: () => String, enum: TaxCalculationTypeEnum })
    @IsOptional()
    @IsEnum(TaxCalculationTypeEnum)
    taxCalculationType?: TaxCalculationTypeEnum;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly tax: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly tax2: number;
}