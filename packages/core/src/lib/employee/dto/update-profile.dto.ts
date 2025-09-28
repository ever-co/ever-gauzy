import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { IntersectionType } from '@nestjs/mapped-types';
import { CurrenciesEnum, IContact, IEmployeeUpdateInput } from '@gauzy/contracts';
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
		PickType(Employee, ['payPeriod', 'reWeeklyLimit'] as const),
		PickType(Employee, ['offerDate', 'acceptDate', 'rejectDate'] as const), // Hiring DTO
		PickType(Employee, ['upworkId', 'linkedInId', 'profile_link', 'isAway'] as const)
	)
	implements IEmployeeUpdateInput
{
	@ApiPropertyOptional({ type: () => Object })
	@IsObject()
	@IsOptional()
	readonly contact?: IContact;

	@ApiPropertyOptional()
	@IsOptional()
	readonly billRateValue?: number;

	@ApiPropertyOptional()
	@IsOptional()
	readonly billRateCurrency?: CurrenciesEnum;

	@ApiPropertyOptional()
	@IsOptional()
	readonly minimumBillingRate?: number;
}
