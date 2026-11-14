import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsOptional,
	IsString,
	IsUUID,
	Validate,
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from 'class-validator';
import { ID, ITimeGoalProgressFindInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { moment } from '../../../core/moment-extend';
import { LOCAL_DATE_FORMAT } from '../time-goal.rules';
import { toIdList } from './id-list.transform';

/** The most members, or goals, one progress read names. */
export const TIME_GOAL_PROGRESS_MAX_IDS = 200;

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'isTimeGoalLocalDate', async: false })
class IsLocalDateConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		const isDateShaped = typeof value === 'string' && LOCAL_DATE_PATTERN.test(value);
		return isDateShaped && moment(value, LOCAL_DATE_FORMAT, true).isValid();
	}

	defaultMessage(args: ValidationArguments): string {
		return `${args.property} must be a valid date in YYYY-MM-DD format`;
	}
}

/**
 * Reads the progress of members against the goals that count them, for the period of each goal that holds `date`
 * in each member's time zone.
 */
export class TimeGoalProgressQueryDTO extends TenantOrganizationBaseDTO implements ITimeGoalProgressFindInput {
	@ApiPropertyOptional({
		type: () => String,
		example: '2026-11-11',
		description: 'Local calendar date, today when absent'
	})
	@IsOptional()
	@IsString()
	@Validate(IsLocalDateConstraint)
	readonly date?: string;

	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@Transform(toIdList)
	@IsArray()
	@ArrayMaxSize(TIME_GOAL_PROGRESS_MAX_IDS)
	@IsUUID('all', { each: true })
	readonly employeeIds?: ID[];

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationTeamId?: ID;

	@ApiPropertyOptional({ type: () => String, isArray: true })
	@IsOptional()
	@Transform(toIdList)
	@IsArray()
	@ArrayMaxSize(TIME_GOAL_PROGRESS_MAX_IDS)
	@IsUUID('all', { each: true })
	readonly goalIds?: ID[];
}
