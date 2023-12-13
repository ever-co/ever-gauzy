import { ITimerStatusInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { RelationsQueryDTO, SelectorsQueryDTO } from './../../../shared/dto';
import { StartTimerDTO } from './start-timer.dto';
import { TodayDateRangeQueryDTO } from './../../statistic/dto';
import { EmployeeFeatureDTO } from './../../../employee/dto';

/**
 * Comprehensive DTO for querying timer status, combining various other DTOs.
 */
export class TimerStatusQueryDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	IntersectionType(
		PartialType(PickType(EmployeeFeatureDTO, ['employeeId'] as const)),
		PartialType(PickType(StartTimerDTO, ['source'] as const)),
		IntersectionType(SelectorsQueryDTO, TodayDateRangeQueryDTO),
		RelationsQueryDTO
	)
) implements ITimerStatusInput { }
