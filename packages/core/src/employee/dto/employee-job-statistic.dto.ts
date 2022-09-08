import { UpdateEmployeeJobsStatistics } from "@gauzy/contracts";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Employee Job Statistic DTO
 */
export class EmployeeJobStatisticDTO extends TenantOrganizationBaseDTO
    implements UpdateEmployeeJobsStatistics {

    @ApiPropertyOptional({ type: () => Boolean, readOnly: true })
	@IsBoolean()
	readonly isJobSearchActive: boolean;
}