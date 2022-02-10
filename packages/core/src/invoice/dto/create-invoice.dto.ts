import { IInvoiceCreateInput, InvoiceTypeEnum, ITag } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNumber, IsOptional, IsString } from "class-validator";
import { InvoiceDTO } from "./invoice.dto";

export class CreateInvoiceDTO extends InvoiceDTO implements IInvoiceCreateInput {

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly status: string;

    @ApiPropertyOptional({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly totalValue: number;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly organizationContactId: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly organizationContactName: string;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly sentTo: string;

    @ApiPropertyOptional({ type: () => String, enum: InvoiceTypeEnum, readOnly: true })
    @IsOptional()
    @IsEnum(InvoiceTypeEnum)
    readonly invoiceType: InvoiceTypeEnum;

    @ApiProperty({ type: () => Object, isArray: true, readOnly: true })
    @IsOptional()
    readonly tags: ITag[];

}