import { JoinTable } from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ICandidate, IEmployee, IOrganizationEmploymentType, ITag } from '@gauzy/contracts';
import {
	Candidate,
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToMany } from './../core/decorators/entity';
import { MikroOrmOrganizationEmploymentTypeRepository } from './repository/mikro-orm-organization-employment-type.repository';

@MultiORMEntity('organization_employment_type', { mikroOrmRepository: () => MikroOrmOrganizationEmploymentTypeRepository })
export class OrganizationEmploymentType extends TenantOrganizationBaseEntity implements IOrganizationEmploymentType {

	@MultiORMColumn()
	name: string;

	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	@ApiPropertyOptional({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.organizationEmploymentTypes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_employment_type',
		joinColumn: 'organizationEmploymentTypeId',
		inverseJoinColumn: 'tagId',
	})
	@JoinTable({
		name: 'tag_organization_employment_type'
	})
	tags?: ITag[];

	/**
	 * Employee
	 */
	@ApiPropertyOptional({ type: () => Employee, isArray: true })
	@MultiORMManyToMany(() => Employee, (employee) => employee.organizationEmploymentTypes, {
		cascade: ['update'],
		owner: true,
		pivotTable: 'organization_employment_type_employee',
		joinColumn: 'organizationEmploymentTypeId',
		inverseJoinColumn: 'employeeId',
	})
	@JoinTable({
		name: 'organization_employment_type_employee'
	})
	members?: IEmployee[];

	/**
	 * Candidate
	 */
	@ApiPropertyOptional({ type: () => Candidate, isArray: true })
	@MultiORMManyToMany(() => Candidate, (candidate) => candidate.organizationEmploymentTypes, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'candidate_employment_type',
		joinColumn: 'organizationEmploymentTypeId',
		inverseJoinColumn: 'candidateId',
	})
	@JoinTable({
		name: 'candidate_employment_type'
	})
	candidates?: ICandidate[];
}
