import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { UpdateEmployeeJobsStatistics } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '@gauzy/core';

/**
 * Employee Job Statistic DTO
 */
export class EmployeeJobStatisticDTO extends TenantOrganizationBaseDTO implements UpdateEmployeeJobsStatistics {
	@ApiProperty({ type: () => Boolean })
	@IsBoolean()
	isJobSearchActive: boolean;
}
