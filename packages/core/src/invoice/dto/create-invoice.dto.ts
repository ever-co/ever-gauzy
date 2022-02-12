import { IInvoiceCreateInput, InvoiceStatusTypesEnum, InvoiceTypeEnum, ITag } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { InvoiceDTO } from "./invoice.dto";

export class CreateInvoiceDTO extends InvoiceDTO implements IInvoiceCreateInput {

    @ApiProperty({ type: () => String, enum: InvoiceStatusTypesEnum, readOnly: true })
    @IsNotEmpty()
    @IsEnum(InvoiceStatusTypesEnum)
    readonly status: InvoiceStatusTypesEnum;

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