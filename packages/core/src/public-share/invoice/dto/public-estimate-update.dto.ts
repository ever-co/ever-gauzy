import { EstimateStatusTypesEnum, IInvoiceUpdateInput } from "@gauzy/contracts";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";

export class PublicEstimateUpdateDTO implements IInvoiceUpdateInput {

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
    @IsOptional()
    @IsBoolean()
    readonly isEstimate: boolean;

    @ApiProperty({ type: () => String, enum: EstimateStatusTypesEnum, readOnly: true })
    @IsOptional()
    @IsEnum(EstimateStatusTypesEnum)
    readonly status: EstimateStatusTypesEnum;
}