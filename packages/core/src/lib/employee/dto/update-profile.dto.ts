import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsObject, IsOptional, Matches, ValidateNested } from 'class-validator';
import { APPLY_FROM_PATTERN } from '../../shared/validators/apply-from';
import { IntersectionType } from '@nestjs/mapped-types';
import { IContact, IEmployeeUpdateInput } from '@gauzy/contracts';
import { EmploymentDTO } from './employment.dto';
import { RelationalTagDTO } from './../../tags/dto';
import { Employee } from './../employee.entity';
import { ProfileContactDTO } from './profile-contact.dto';

/**
 * EMPLOYEE can updates these fields only
 * Public Fields DTO
 */
export class UpdateProfileDTO
	extends IntersectionType(
		RelationalTagDTO,
		EmploymentDTO,
		PickType(Employee, [
			'linkedInUrl',
			'facebookUrl',
			'instagramUrl',
			'twitterUrl',
			'githubUrl',
			'gitlabUrl',
			'upworkUrl',
			'stackoverflowUrl'
		] as const), // Networks DTO
		PickType(Employee, [
			'billRateValue',
			'billRateCurrency',
			'minimumBillingRate',
			'payPeriod',
			'reWeeklyLimit'
		] as const),
		PickType(Employee, ['offerDate', 'acceptDate', 'rejectDate'] as const), // Hiring DTO
		PickType(Employee, ['upworkId', 'linkedInId', 'profile_link', 'isAway'] as const)
	)
	implements IEmployeeUpdateInput
{
	/**
	 * The profile's own contact: postal, geographic and fiscal facts only (see {@link ProfileContactDTO}). The
	 * nested whitelist strips an `id` or a scope member, and the handler writes the stored contact row.
	 */
	@ApiPropertyOptional({ type: () => ProfileContactDTO })
	@IsObject()
	@IsOptional()
	@ValidateNested()
	@Type(() => ProfileContactDTO)
	readonly contact?: IContact;

	/**
	 * The day a billing or pay rate this update sets prices tracked time from. Without it, all the time already
	 * tracked takes the new rate, unless the organization's time logs keep their rates: then only time recorded from
	 * now on takes it, and past time keeps its price.
	 */
	@ApiPropertyOptional({
		type: () => String,
		format: 'date-time',
		description:
			'Apply the rates this update sets to the time logs started on or after this day (time a live invoice ' +
			"bills keeps its price). Without it, all the time already tracked takes them, unless the organization's " +
			'time logs keep their rates (timeLogsKeepTheirRates): then only time recorded from now on does.'
	})
	@IsOptional()
	@IsDateString()
	@Matches(APPLY_FROM_PATTERN, { message: 'ratesApplyFrom must be a date or a date-time with its offset' })
	readonly ratesApplyFrom?: string;
}
