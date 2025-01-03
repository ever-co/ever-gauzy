import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { IntersectionType } from '@nestjs/mapped-types';
import { IContact, IEmployeeUpdateInput } from '@gauzy/contracts';
import { EmploymentDTO } from './employment.dto';
import { RelationalTagDTO } from './../../tags/dto';
import { Employee } from './../employee.entity';

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
	@ApiPropertyOptional({ type: () => Object })
	@IsObject()
	@IsOptional()
	readonly contact?: IContact;
}
