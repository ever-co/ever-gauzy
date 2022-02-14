import { IInvoiceUpdateInput } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsNotEmpty, IsOptional } from "class-validator";
import { InvoiceDTO } from "./invoice.dto";

export class UpdateInvoiceDTO extends InvoiceDTO implements IInvoiceUpdateInput {

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    readonly tax: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    readonly tax2: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    readonly discountValue: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsNotEmpty()
    readonly invoiceNumber: number;

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isArchived: boolean;

}