import { UpdateEmployeeJobsStatistics } from "@gauzy/contracts";
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";
import { TenantOrganizationBaseDTO } from "./../../core/dto";

/**
 * Employee Job Statistic DTO
 */
export class EmployeeJobStatisticDTO extends TenantOrganizationBaseDTO implements UpdateEmployeeJobsStatistics {

    @ApiProperty({ type: () => Boolean })
    @IsBoolean()
    isJobSearchActive: boolean;
}
