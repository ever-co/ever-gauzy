import { EstimateStatusTypesEnum, InvoiceStatusEnumType, InvoiceStatusTypesEnum } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateInvoiceActionDTO {

    @ApiProperty({ type: () => String, enum: Object.assign({}, InvoiceStatusTypesEnum, EstimateStatusTypesEnum), readOnly: true })
    @IsOptional()
    @IsEnum(Object.assign({}, InvoiceStatusTypesEnum, EstimateStatusTypesEnum))
    readonly status: InvoiceStatusEnumType;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isEstimate: boolean;

    @ApiProperty({ type: () => String, readOnly: true })
    @IsOptional()
    @IsString()
    readonly internalNote: string;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isArchived: boolean;

    @ApiProperty({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly paid: boolean;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly alreadyPaid: number;

    @ApiProperty({ type: () => Number, readOnly: true })
    @IsOptional()
    @IsNumber()
    readonly amountDue: number;
}