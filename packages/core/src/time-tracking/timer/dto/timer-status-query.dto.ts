import { ITimerStatusInput } from '@gauzy/contracts';
import { IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { EmployeeFeatureDTO } from './../../../employee/dto';
import { TenantOrganizationBaseDTO } from './../../../core/dto';
import { RelationsQueryDTO } from './../../../shared/dto';
import { StartTimerDTO } from './start-timer.dto';
import { TodayDateRangeQueryDTO } from 'time-tracking/statistic/dto';

export class TimerStatusQueryDTO extends IntersectionType(TenantOrganizationBaseDTO, IntersectionType(
	PartialType(PickType(EmployeeFeatureDTO, ['employeeId'] as const)),
	PartialType(PickType(StartTimerDTO, ['source'] as const)),
	RelationsQueryDTO,
	TodayDateRangeQueryDTO
)) implements ITimerStatusInput { }
