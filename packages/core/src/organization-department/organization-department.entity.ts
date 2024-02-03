import {
	IOrganizationDepartment,
	ITag,
	IEmployee,
	ICandidate
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Column, Index, JoinTable } from 'typeorm';
import {
	Candidate,
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmOrganizationDepartmentRepository } from './repository/mikro-orm-organization-department.repository';
import { MultiORMManyToMany } from '../core/decorators/entity/relations';

@MultiORMEntity('organization_department', { mikroOrmRepository: () => MikroOrmOrganizationDepartmentRepository })
export class OrganizationDepartment extends TenantOrganizationBaseEntity implements IOrganizationDepartment {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name: string;
	/*
	|--------------------------------------------------------------------------
	| @ManyToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * Tag
	 */
	@ApiProperty({ type: () => Tag, isArray: true })
	@MultiORMManyToMany(() => Tag, (tag) => tag.organizationDepartments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'tag_organization_department',
	})
	@JoinTable({
		name: 'tag_organization_department'
	})
	tags?: ITag[];

	/**
	 * Employee
	 */
	@ApiProperty({ type: () => Employee, isArray: true })
	@MultiORMManyToMany(() => Employee, (employee) => employee.organizationDepartments, {
		cascade: ['update'],
		owner: true,
		pivotTable: 'organization_department_employee',
	})
	@JoinTable({
		name: 'organization_department_employee'
	})
	members?: IEmployee[];

	/**
	 * Candidate
	 */
	@ApiProperty({ type: () => Candidate, isArray: true })
	@MultiORMManyToMany(() => Candidate, (candidate) => candidate.organizationDepartments, {
		onUpdate: 'CASCADE',
		onDelete: 'CASCADE',
		owner: true,
		pivotTable: 'candidate_department',
	})
	@JoinTable({
		name: 'candidate_department'
	})
	candidates?: ICandidate[];
}
