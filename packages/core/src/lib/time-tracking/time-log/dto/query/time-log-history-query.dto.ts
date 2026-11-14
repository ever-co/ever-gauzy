import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsDateString,
	IsEnum,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsUUID,
	Max,
	Min
} from 'class-validator';
import { ID, ITimeLogHistoryFindInput, TimeLogChangeKindEnum } from '@gauzy/contracts';
import { TenantBaseDTO } from '../../../../core/dto';
import { IsBeforeDate, IsOrganizationBelongsToUser } from '../../../../shared/validators';

/** The largest page of `GET /timesheet/time-log/history`. */
export const TIME_LOG_HISTORY_MAX_TAKE = 500;

/**
 * The organization a history read is made in. The reads bind `organizationId` alone, so it is always required and
 * one of the caller's; the `organization` object other queries accept in its place is not.
 */
export class TimeLogHistoryOrganizationQueryDTO extends TenantBaseDTO {
	@ApiProperty({ type: () => String })
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: ID;
}

/** The changes of a period, as `GET /timesheet/time-log/history` reads them. */
export class TimeLogHistoryQueryDTO extends TimeLogHistoryOrganizationQueryDTO implements ITimeLogHistoryFindInput {
	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	@IsBeforeDate(TimeLogHistoryQueryDTO, (it) => it.endDate, {
		message: 'Start date must be before to the end date'
	})
	readonly startDate: Date;

	@ApiProperty({ type: () => Date })
	@IsNotEmpty()
	@IsDateString()
	readonly endDate: Date;

	@ApiPropertyOptional({ type: () => Array, isArray: true })
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(500)
	@IsUUID('all', { each: true })
	readonly employeeIds?: ID[];

	@ApiPropertyOptional({ enum: TimeLogChangeKindEnum, isArray: true })
	@IsOptional()
	@IsArray()
	@IsEnum(TimeLogChangeKindEnum, { each: true })
	readonly kinds?: TimeLogChangeKindEnum[];

	@ApiPropertyOptional({ type: () => Number, default: 100, maximum: TIME_LOG_HISTORY_MAX_TAKE })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(TIME_LOG_HISTORY_MAX_TAKE)
	readonly take?: number;

	@ApiPropertyOptional({ type: () => Number, default: 1, description: '1-based page number' })
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	readonly skip?: number;
}
