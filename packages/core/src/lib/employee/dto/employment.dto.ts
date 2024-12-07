import { IOrganizationDepartment, IOrganizationEmploymentType, IOrganizationPosition, ISkill } from '@gauzy/contracts';
import { ApiPropertyOptional, IntersectionType, PickType } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { CreateOrganizationEmploymentTypeDTO } from './../../organization-employment-type/dto';
import { CreateOrganizationDepartmentDTO } from './../../organization-department/dto';
import { Employee } from '../employee.entity';

export class EmploymentDTO extends IntersectionType(
	TenantOrganizationBaseDTO,
	PickType(Employee, [
		'startedWorkOn',
		'endWork',
		'short_description',
		'description',
		'anonymousBonus',
		'employeeLevel'
	] as const)
) {
	@ApiPropertyOptional({ type: () => [CreateOrganizationEmploymentTypeDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateOrganizationEmploymentTypeDTO)
	readonly organizationEmploymentTypes?: IOrganizationEmploymentType[];

	@ApiPropertyOptional({ type: () => [CreateOrganizationDepartmentDTO] })
	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => CreateOrganizationDepartmentDTO)
	readonly organizationDepartments?: IOrganizationDepartment[];

	@ApiPropertyOptional({ type: () => Object })
	@IsOptional()
	@IsObject()
	readonly organizationPosition?: IOrganizationPosition;

	@ApiPropertyOptional({ type: () => [String] })
	@IsOptional()
	@IsArray()
	readonly skills?: ISkill[];
}
