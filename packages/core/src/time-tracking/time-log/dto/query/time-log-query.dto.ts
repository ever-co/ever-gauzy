import { IGetTimeLogReportInput, IOrganizationTeam, ITimesheet, ReportGroupFilterEnum } from "@gauzy/contracts";
import { IntersectionType } from "@nestjs/swagger";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { FiltersQueryDTO, RelationsQueryDTO, SelectorsQueryDTO } from "../../../../shared/dto";

/**
 * Get time log request DTO validation
 */
export class TimeLogQueryDTO extends IntersectionType(
    FiltersQueryDTO,
    IntersectionType(SelectorsQueryDTO, RelationsQueryDTO)
) implements IGetTimeLogReportInput {

    @ApiPropertyOptional({ type: () => Array, enum: ReportGroupFilterEnum, readOnly: true })
    @IsOptional()
    @IsEnum(ReportGroupFilterEnum)
    readonly groupBy: ReportGroupFilterEnum;

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsUUID()
    readonly timesheetId: ITimesheet['id'];

    @ApiPropertyOptional({ type: () => String, readOnly: true })
    @IsOptional()
    @IsUUID()
    readonly teamId: IOrganizationTeam['id'];
}