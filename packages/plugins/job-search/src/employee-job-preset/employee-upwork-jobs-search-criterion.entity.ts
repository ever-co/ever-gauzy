import { JoinColumn, RelationId } from 'typeorm';
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
import { Employee, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne } from '@gauzy/core';
import { JobPreset } from './job-preset.entity';
import { JobSearchOccupation } from './job-search-occupation/job-search-occupation.entity';
import { JobSearchCategory } from './job-search-category/job-search-category.entity';
import { MikroOrmEmployeeUpworkJobsSearchCriterionRepository } from './repository/mikro-orm-employee-upwork-jobs-search-criterion.entity.repository';

@MultiORMEntity('employee_upwork_job_search_criterion', { mikroOrmRepository: () => MikroOrmEmployeeUpworkJobsSearchCriterionRepository })
export class EmployeeUpworkJobsSearchCriterion extends TenantOrganizationBaseEntity implements IEmployeeUpworkJobsSearchCriterion {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: true })
	keyword?: string;

	@ApiProperty({ type: () => Boolean })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ type: 'text', nullable: true })
	jobType?: JobPostTypeEnum;

	/*
	|--------------------------------------------------------------------------
	| @ManyToOne
	|--------------------------------------------------------------------------
	*/

	/**
	 *
	 */
	@MultiORMManyToOne(() => JobPreset, (it) => it.employeeCriterions, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true
	})
	@JoinColumn()
	jobPreset?: IJobPreset;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.jobPreset)
	@MultiORMColumn({ nullable: true, relationId: true })
	jobPresetId?: string;

	/**
	 *
	 */
	@MultiORMManyToOne(() => Employee)
	@JoinColumn()
	employee?: IEmployee;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.employee)
	@MultiORMColumn({ relationId: true })
	employeeId?: string;

	/**
	 *
	 */
	@MultiORMManyToOne(() => JobSearchOccupation, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true
	})
	@JoinColumn()
	occupation?: IJobSearchOccupation;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.occupation)
	@MultiORMColumn({ nullable: true, relationId: true })
	occupationId?: string;

	/**
	 *
	 */
	@MultiORMManyToOne(() => JobSearchCategory, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true
	})
	@JoinColumn()
	category?: IJobSearchCategory;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: EmployeeUpworkJobsSearchCriterion) => it.category)
	@MultiORMColumn({ nullable: true, relationId: true })
	categoryId?: string;
}
