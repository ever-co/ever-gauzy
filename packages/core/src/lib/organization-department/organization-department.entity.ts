import {
	IOrganizationDepartment,
	ITag,
	IEmployee,
	ICandidate
} from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { JoinTable } from 'typeorm';
import {
	Candidate,
	Employee,
	Tag,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, MultiORMManyToMany } from './../core/decorators/entity';
import { MikroOrmOrganizationDepartmentRepository } from './repository/mikro-orm-organization-department.repository';

@MultiORMEntity('organization_department', { mikroOrmRepository: () => MikroOrmOrganizationDepartmentRepository })
export class OrganizationDepartment extends TenantOrganizationBaseEntity implements IOrganizationDepartment {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@ColumnIndex()
	@MultiORMColumn()
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
		joinColumn: 'organizationDepartmentId',
		inverseJoinColumn: 'tagId',

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
		joinColumn: 'organizationDepartmentId',
		inverseJoinColumn: 'employeeId',
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
		joinColumn: 'organizationDepartmentId',
		inverseJoinColumn: 'candidateId',
	})
	@JoinTable({
		name: 'candidate_department'
	})
	candidates?: ICandidate[];
}
