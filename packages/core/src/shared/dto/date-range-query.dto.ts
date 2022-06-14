import { IDateRangePicker } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Get date range common request DTO validation
 */
export class DateRangeQueryDTO extends TenantOrganizationBaseDTO implements IDateRangePicker {
 
    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly startDate: Date;

    @ApiPropertyOptional({ type: () => Date })
    @IsOptional()
    @IsString()
    readonly endDate: Date;
}