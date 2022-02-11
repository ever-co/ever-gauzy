import { IInvoice, IUser } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export abstract class InvoiceEstimeHistoryDTO extends TenantOrganizationBaseDTO {

    @ApiPropertyOptional({ type: () => String, readOnly : true })
    @IsString()
    readonly action: string;

    @ApiPropertyOptional({ type: () => Object, readOnly : true })
    readonly user: IUser;

    @ApiPropertyOptional({ type: () => String, readOnly : true })
    readonly userId: string;

    @ApiPropertyOptional({ type: () => Object, readOnly : true })
    readonly invoice: IInvoice;

    @ApiPropertyOptional({ type: () => String, readOnly : true })
    readonly invoiceId: string;

}