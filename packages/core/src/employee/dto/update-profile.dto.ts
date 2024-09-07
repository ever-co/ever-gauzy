import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';
import { IntersectionType } from '@nestjs/mapped-types';
import { IContact, IEmployeeUpdateInput } from '@gauzy/contracts';
import { SocialNetworksDTO } from './network.dto';
import { EmploymentDTO } from './employment.dto';
import { HiringDTO } from './hiring.dto';
import { RatesDTO } from './rates.dto';
import { RelationalTagDTO } from './../../tags/dto';
import { Employee } from './../employee.entity';

/**
 * EMPLOYEE can updates these fields only
 * Public Fields DTO
 */
export class UpdateProfileDTO
	extends IntersectionType(
		SocialNetworksDTO,
		EmploymentDTO,
		HiringDTO,
		RatesDTO,
		RelationalTagDTO,
		PickType(Employee, ['upworkId', 'linkedInId', 'profile_link', 'isAway'] as const)
	)
	implements IEmployeeUpdateInput
{
	@ApiPropertyOptional({ type: () => Object })
	@IsObject()
	@IsOptional()
	readonly contact?: IContact;
}
