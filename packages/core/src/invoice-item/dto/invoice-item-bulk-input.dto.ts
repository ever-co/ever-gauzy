import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateInvoiceItemDTO } from ".";

export class InvoiceItemBulkInputDTO {

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateInvoiceItemDTO)
    list : CreateInvoiceItemDTO[]
}