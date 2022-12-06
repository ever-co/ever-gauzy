import { IGetPaymentInput, ReportGroupFilterEnum } from "@gauzy/contracts";
import { ApiPropertyOptional, IntersectionType } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { RelationsQueryDTO, SelectorsQueryDTO } from "./../../../shared/dto";

/**
 * Get payment report request DTO validation
 */
export class PaymentReportQueryDTO extends IntersectionType(
    SelectorsQueryDTO,
    RelationsQueryDTO
) implements IGetPaymentInput {

    @ApiPropertyOptional({ enum: ReportGroupFilterEnum, readOnly: true })
    @IsOptional()
    @IsEnum(ReportGroupFilterEnum)
    readonly groupBy: ReportGroupFilterEnum;
}