import { IInvoiceCreateInput, InvoiceTypeEnum, IOrganization, ITag } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNotEmptyObject, IsNumber, IsObject, IsOptional, IsString, ValidateIf } from "class-validator";
import { InvoiceDTO } from "./invoice.dto";
import { TaxInvoiceDTO } from "./taxes.dto";

export class CreateInvoiceDTO extends IntersectionType(
    InvoiceDTO,
    TaxInvoiceDTO
) implements IInvoiceCreateInput {
    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly discountValue: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsNotEmpty()
    @IsNumber()
    readonly invoiceNumber: number;

    @ApiPropertyOptional({ type: () => Object, readOnly: true })
    @ValidateIf(o => !o.fromOrganizationId || o.fromOrganization)
    @IsNotEmptyObject()
    @IsObject()
    readonly fromOrganization: IOrganization;

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf(o => !o.fromOrganization || o.fromOrganizationId)
    @IsNotEmpty()
    @IsString()
    readonly fromOrganizationId: string;

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