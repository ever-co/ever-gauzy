import { DiscountTaxTypeEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsNumber, IsEnum } from "class-validator";

export class DiscountInvoiceDTO {
    
    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly discountValue: number;

    @ApiProperty({ type: () => String, enum: DiscountTaxTypeEnum, readOnly: true })
    @IsOptional()
    @IsEnum(DiscountTaxTypeEnum)
    readonly discountType: DiscountTaxTypeEnum;
}