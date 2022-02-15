import { IInvoiceUpdateInput } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { InvoiceDTO } from "./invoice.dto";

export class UpdateInvoiceDTO extends InvoiceDTO implements IInvoiceUpdateInput {

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isArchived: boolean;

}