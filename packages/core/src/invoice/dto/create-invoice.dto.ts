import { IInvoiceCreateInput, IOrganization } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, IsString, ValidateIf } from "class-validator";
import { InvoiceDTO } from "./invoice.dto";

export class CreateInvoiceDTO extends InvoiceDTO implements IInvoiceCreateInput {
    
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

}