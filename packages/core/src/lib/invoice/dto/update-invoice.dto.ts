import { IInvoiceUpdateInput } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { RelationalTagDTO } from "./../../tags/dto";
import { DiscountInvoiceDTO } from "./discount-invoice.dto";
import { InvoiceDTO } from "./invoice.dto";
import { TaxInvoiceDTO } from "./tax-invoice.dto";

export class UpdateInvoiceDTO extends IntersectionType(
    InvoiceDTO,
    TaxInvoiceDTO,
    RelationalTagDTO,
    DiscountInvoiceDTO
) implements IInvoiceUpdateInput {}