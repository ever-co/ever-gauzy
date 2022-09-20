import { IGetExpenseInput, ReportGroupFilterEnum } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/mapped-types";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { RelationsQueryDTO, SelectorsQueryDTO } from "./../../../shared/dto";

/**
 * Get expense report request DTO validation
 */
export class ExpenseReportQueryDTO extends IntersectionType(
    RelationsQueryDTO,
    SelectorsQueryDTO
) implements IGetExpenseInput {

    @ApiPropertyOptional({ type: () => Array, enum: ReportGroupFilterEnum })
    @IsOptional()
    @IsEnum(ReportGroupFilterEnum)
    readonly groupBy: ReportGroupFilterEnum;
}