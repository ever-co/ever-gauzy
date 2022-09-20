import { IGetPaymentInput, ReportGroupFilterEnum } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { RelationsQueryDTO, SelectorsQueryDTO } from "./../../../shared/dto";

/**
 * Get payment report request DTO validation
 */
export class PaymentReportQueryDTO extends IntersectionType(
    RelationsQueryDTO,
    SelectorsQueryDTO
) implements IGetPaymentInput {

    @ApiPropertyOptional({ type: () => Array, enum: ReportGroupFilterEnum })
    @IsOptional()
    @IsEnum(ReportGroupFilterEnum)
    readonly groupBy: ReportGroupFilterEnum;
}