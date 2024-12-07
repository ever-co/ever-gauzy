import { IDateRangePicker } from "@gauzy/contracts";
import { ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import { IsDateString, IsOptional } from "class-validator";
import { IsBeforeDate } from "./../../shared/validators";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Get date range common request DTO validation
 */
export class DateRangeQueryDTO extends OmitType(TenantOrganizationBaseDTO, ['sentTo']) implements IDateRangePicker {

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDateString()
    @IsBeforeDate(DateRangeQueryDTO, (it) => it.endDate, {
        message: "Start date must be before to the end date"
    })
    readonly startDate: Date;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsDateString()
    readonly endDate: Date;
}
