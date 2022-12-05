import { IGetTimeLogReportInput, ReportGroupFilterEnum } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/swagger";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO } from "../../../../shared/dto";

/**
 * Get time log daily/wewkly limit request DTO validation
 */
export class TimeLogLimitQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    IntersectionType(SelectorsQueryDTO, RelationsQueryDTO)
) implements IGetTimeLogReportInput {

    @ApiPropertyOptional({ type: () => String, enum: ReportGroupFilterEnum })
    @IsOptional()
    @IsEnum(ReportGroupFilterEnum)
    readonly groupBy: ReportGroupFilterEnum;

    @ApiPropertyOptional({ type: () => String })
    @IsOptional()
    readonly duration: 'day' | 'week' | 'month';
}