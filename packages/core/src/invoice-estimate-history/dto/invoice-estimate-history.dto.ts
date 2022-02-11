import { IInvoice, IUser } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "core/dto";

export abstract class InvoiceEstimeHistoryDTO extends TenantOrganizationBaseDTO {

    @ApiPropertyOptional({ type: () => String, readOnly : true })
    @IsNotEmpty()
    @IsString()
    readonly action: string;

    @ApiPropertyOptional({ type: () => Object, readOnly : true })
    @IsOptional()
    @IsObject()
    readonly user: IUser;

    @ApiPropertyOptional({ type: () => String, readOnly : true })
    @IsNotEmpty()
    @IsString()
    readonly userId: string;

    @ApiPropertyOptional({ type: () => Object, readOnly : true })
    @IsOptional()
    @IsObject()
    readonly invoice: IInvoice;

    @ApiPropertyOptional({ type: () => String, readOnly : true })
    @IsNotEmpty()
    @IsString()
    readonly invoiceId: string;

}