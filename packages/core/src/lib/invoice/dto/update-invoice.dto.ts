import { IInvoiceUpdateInput, InvoiceTypeEnum } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { RelationalTagDTO } from "./../../tags/dto";
import { DiscountInvoiceDTO } from "./discount-invoice.dto";
import { InvoiceDTO } from "./invoice.dto";
import { TaxInvoiceDTO } from "./tax-invoice.dto";

/**
 * PUT /invoices/:id runs with `whitelist: true` (GHSA-jh6m-9fxr-rx3c), so every field the invoice
 * edit screen sends has to be declared here or on the DTOs it extends.
 */
export class UpdateInvoiceDTO extends IntersectionType(
    InvoiceDTO,
    TaxInvoiceDTO,
    RelationalTagDTO,
    DiscountInvoiceDTO
) implements IInvoiceUpdateInput {

    @ApiPropertyOptional({ type: () => String, enum: InvoiceTypeEnum, readOnly: true })
    @IsOptional()
    @IsEnum(InvoiceTypeEnum)
    readonly invoiceType?: InvoiceTypeEnum;
}
