import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	IEmployee,
	IEmployeeUpworkJobsSearchCriterion,
	IJobPreset,
	IJobSearchCategory,
	IJobSearchOccupation,
	JobPostTypeEnum
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import {
	Employee,
	JobPreset,
	JobSearchCategory,
	JobSearchOccupation,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';

@Entity('employee_upwork_job_search_criterion')
export class EmployeeUpworkJobsSearchCriterion
	extends TenantOrganizationBaseEntity
	implements IEmployeeUpworkJobsSearchCriterion {
	constructor(input?: DeepPartial<EmployeeUpworkJobsSearchCriterion>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	jobPresetId?: string;

	@ManyToOne(() => JobPreset, (jobPreset) => jobPreset.employeeCriterions)
	jobPreset?: IJobPreset;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	employeeId?: string;

	@ManyToOne(() => Employee, (employee) => employee.id)
	employee?: IEmployee;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	occupationId?: string;

	@ManyToOne(
		() => JobSearchOccupation,
		(occupation) => occupation.employeeCriterions
	)
	occupation?: IJobSearchOccupation;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	categoryId?: string;

	@ManyToOne(
		() => JobSearchCategory,
		(category) => category.employeeCriterions
	)
	category?: IJobSearchCategory;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	keyword?: string;

	@ApiProperty({ type: Boolean })
	@IsString()
	@IsNotEmpty()
	@Column({ type: 'text', nullable: true })
	jobType?: JobPostTypeEnum;
}
