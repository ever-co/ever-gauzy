import { ICandidate, IEmployee, IOrganizationEmploymentType, ITag } from '@gauzy/contracts';
import { Column, JoinTable } from 'typeorm';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
	Candidate,
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationEmploymentTypeRepository } from './repository/mikro-orm-organization-employment-type.repository';
import { MultiORMManyToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_employment_type', { mikroOrmRepository: () => MikroOrmOrganizationEmploymentTypeRepository })
export class OrganizationEmploymentType extends TenantOrganizationBaseEntity implements IOrganizationEmploymentType {

	@Column()
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
	})
	@JoinTable({
		name: 'candidate_employment_type'
	})
	candidates?: ICandidate[];
}
