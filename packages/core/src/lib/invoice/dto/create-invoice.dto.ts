
import { IInvoiceCreateInput, InvoiceTypeEnum, IOrganization } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
    IsEnum,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    ValidateIf
} from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { DiscountInvoiceDTO } from "./discount-invoice.dto";
import { InvoiceDTO } from "./invoice.dto";
import { TaxInvoiceDTO } from "./tax-invoice.dto";

export class CreateInvoiceDTO extends IntersectionType(
    InvoiceDTO,
    TaxInvoiceDTO,
    RelationalTagDTO,
    DiscountInvoiceDTO
) implements IInvoiceCreateInput {
    @ApiPropertyOptional({ type: () => Object, readOnly: true })
    @ValidateIf((it) => !it.fromOrganizationId)
    @IsObject()
    readonly fromOrganization: IOrganization;

    @ApiProperty({ type: () => String, readOnly: true })
    @ValidateIf((it) => !it.fromOrganization)
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
}