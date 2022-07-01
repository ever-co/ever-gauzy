import { IGetPaymentInput, ReportGroupFilterEnum } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEnum, IsOptional } from "class-validator";
import { SelectorsQueryDTO } from "./../../../shared/dto";

/**
 * Get payment report request DTO validation
 */
export class PaymentReportQueryDTO extends SelectorsQueryDTO implements IGetPaymentInput {
    
    @ApiPropertyOptional({ type: () => Array, enum: ReportGroupFilterEnum })
    @IsOptional()
    @IsEnum(ReportGroupFilterEnum)
    readonly groupBy: ReportGroupFilterEnum;

    @ApiPropertyOptional({ type: () => Array, isArray: true })
    @IsOptional()
    @IsArray()
    readonly relations: string[];
}