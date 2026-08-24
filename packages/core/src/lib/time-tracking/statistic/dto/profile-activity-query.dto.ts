import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
	IsBoolean,
	IsOptional,
	IsString,
	IsUUID,
	Validate,
	ValidationArguments,
	ValidatorConstraint,
	ValidatorConstraintInterface
} from 'class-validator';
import { ID, IGetProfileActivity } from '@gauzy/contracts';
import { moment } from '../../../core/moment-extend';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LOCAL_CALENDAR_SPAN_DAYS = 366;

function isStrictLocalDate(value: unknown): value is string {
	return typeof value === 'string' && DATE_ONLY_PATTERN.test(value) && moment(value, 'YYYY-MM-DD', true).isValid();
}

function isIanaTimeZone(value: unknown): value is string {
	return typeof value === 'string' && moment.tz.zone(value) !== null;
}

@ValidatorConstraint({ name: 'isStrictLocalDate', async: false })
class IsStrictLocalDateConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isStrictLocalDate(value);
	}

	defaultMessage(args: ValidationArguments): string {
		return `${args.property} must be a valid date in YYYY-MM-DD format`;
	}
}

@ValidatorConstraint({ name: 'isIanaTimeZone', async: false })
class IsIanaTimeZoneConstraint implements ValidatorConstraintInterface {
	validate(value: unknown): boolean {
		return isIanaTimeZone(value);
	}

	defaultMessage(args: ValidationArguments): string {
		return `${args.property} must be a valid IANA time zone`;
	}
}

@ValidatorConstraint({ name: 'isProfileActivityDateRange', async: false })
class IsProfileActivityDateRangeConstraint implements ValidatorConstraintInterface {
	validate(_value: unknown, args: ValidationArguments): boolean {
		const query = args.object as ProfileActivityQueryDTO;

		if (
			!isStrictLocalDate(query.startDate) ||
			!isStrictLocalDate(query.endDate) ||
			!isIanaTimeZone(query.timeZone)
		) {
			return true;
		}

		const start = moment.utc(query.startDate, 'YYYY-MM-DD', true);
		const end = moment.utc(query.endDate, 'YYYY-MM-DD', true);
		const localCalendarSpanDays = end.diff(start, 'days');

		return end.isAfter(start) && localCalendarSpanDays <= MAX_LOCAL_CALENDAR_SPAN_DAYS;
	}

	defaultMessage(): string {
		return `endDate must be after startDate and the half-open date span must not exceed ${MAX_LOCAL_CALENDAR_SPAN_DAYS} local calendar days`;
	}
}

export class ProfileActivityQueryDTO implements IGetProfileActivity {
	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly organizationId: ID;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly employeeId: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationTeamId?: ID;

	@ApiProperty({ type: () => String, example: '2024-01-01' })
	@IsString()
	@Validate(IsStrictLocalDateConstraint)
	readonly startDate: string;

	@ApiProperty({ type: () => String, example: '2024-01-31' })
	@IsString()
	@Validate(IsStrictLocalDateConstraint)
	@Validate(IsProfileActivityDateRangeConstraint)
	readonly endDate: string;

	@ApiProperty({ type: () => String, example: 'America/New_York' })
	@IsString()
	@Validate(IsIanaTimeZoneConstraint)
	readonly timeZone: string;

	@ApiPropertyOptional({ type: () => Boolean, default: false })
	@Transform(({ value }: TransformFnParams) => {
		if (value === 'true') return true;
		if (value === 'false') return false;

		return value;
	})
	@IsBoolean()
	readonly includeDaily: boolean = false;
}
