import { IDateRangePicker } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

/**
 * Get date range common request DTO validation
 */
export class DateRangeQueryDTO implements IDateRangePicker {
 
    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly startDate: Date;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly endDate: Date;
}