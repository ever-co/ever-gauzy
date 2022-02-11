import { IInvoice, IInvoiceEstimateHistory, IOrganization, ITenant, IUser } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class InvoiceHistoryDTO implements IInvoiceEstimateHistory {

    @ApiPropertyOptional({ type: () => String })
    @IsString()
    readonly action: string;

    @ApiPropertyOptional({ type: () => Object })
    readonly user: IUser;

    @ApiPropertyOptional({ type: () => String })
    readonly userId: string;

    @ApiPropertyOptional({ type: () => Object })
    readonly invoice: IInvoice;

    @ApiPropertyOptional({ type: () => String })
    readonly invoiceId: string;

    @ApiPropertyOptional({ type: () => String })
    readonly organizationId: string;

    @ApiPropertyOptional({ type: () => Object })
    readonly organization: IOrganization;

    @ApiPropertyOptional({ type: () => String })
    readonly tenantId: string;

    @ApiPropertyOptional({ type: () => String })
    readonly tenant: ITenant;
    
}