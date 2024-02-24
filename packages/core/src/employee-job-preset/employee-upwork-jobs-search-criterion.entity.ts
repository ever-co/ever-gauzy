import { Column, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import {
	IEmployee,
	IEmployeeUpworkJobsSearchCriterion,
	IJobPreset,
	IJobSearchCategory,
	IJobSearchOccupation,
	JobPostTypeEnum
} from '@gauzy/contracts';
import {
	Employee,
	JobPreset,
	JobSearchCategory,
	JobSearchOccupation,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmEmployeeUpworkJobsSearchCriterionRepository } from './repository/mikro-orm-employee-upwork-jobs-search-criterion.entity.repository';

@MultiORMEntity('employee_upwork_job_search_criterion', { mikroOrmRepository: () => MikroOrmEmployeeUpworkJobsSearchCriterionRepository })
export class EmployeeUpworkJobsSearchCriterion extends TenantOrganizationBaseEntity implements IEmployeeUpworkJobsSearchCriterion {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	keyword?: string;

	@ApiProperty({ type: () => Boolean })
	@IsString()
	@IsNotEmpty()
	@Column({ type: 'text', nullable: true })
	jobType?: JobPostTypeEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 *
	 */
	@ManyToOne(() => JobPreset, (it) => it.employeeCriterions)
	jobPreset?: IJobPreset;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.jobPreset)
	@Column({ nullable: true })
	jobPresetId?: string;

	/**
	 *
	 */
	@ManyToOne(() => Employee)
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.employee)
	@Column()
	employeeId?: string;

	/**
	 *
	 */
	@ManyToOne(() => JobSearchOccupation, (it) => it.employeeCriterions)
	occupation?: IJobSearchOccupation;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.occupation)
	@Column({ nullable: true })
	occupationId?: string;

	/**
	 *
	 */
	@ManyToOne(() => JobSearchCategory, (it) => it.employeeCriterions)
	category?: IJobSearchCategory;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.category)
	@Column({ nullable: true })
	categoryId?: string;
}
