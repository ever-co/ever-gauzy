import { IDateRangePicker } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { IsBeforeDate } from "./../../shared/validators";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Get date range common request DTO validation
 */
export class DateRangeQueryDTO extends TenantOrganizationBaseDTO implements IDateRangePicker {

    @ApiPropertyOptional({ type: () => Date, readOnly: true })
    @IsOptional()
    @IsString()
    @IsBeforeDate(DateRangeQueryDTO, (it) => it.endDate, {
        message: "Start date must be before to the end date"
    })
    readonly startDate: Date;

    @ApiPropertyOptional({ type: () => Date, readOnly: true })
    @IsOptional()
    @IsString()
    readonly endDate: Date;
}