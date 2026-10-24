import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, ValidateNested } from 'class-validator';
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
}
