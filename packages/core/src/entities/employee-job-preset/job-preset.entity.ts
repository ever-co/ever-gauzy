import {
	Column,
	Entity,
	Index,
	JoinTable,
	ManyToMany,
	OneToMany
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	IEmployeeUpworkJobsSearchCriterion,
	IJobPresetUpworkJobSearchCriterion,
	IJobPreset,
	DeepPartial
} from '@gauzy/common';
import {
	Employee,
	EmployeeUpworkJobsSearchCriterion,
	JobPresetUpworkJobSearchCriterion,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('job_preset')
export class JobPreset
	extends TenantOrganizationBaseEntity
	implements IJobPreset {
	constructor(input?: DeepPartial<JobPreset>) {
		super(input);
	}

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	@ManyToMany(() => Employee, (employee) => employee.jobPresets, {
		cascade: true
	})
	@JoinTable({
		name: 'employee_job_preset'
	})
	employees?: Employee[];

	@OneToMany(
		() => EmployeeUpworkJobsSearchCriterion,
		(employeeUpworkJobsSearchCriterion) =>
			employeeUpworkJobsSearchCriterion.jobPreset,
		{
			onDelete: 'CASCADE'
		}
	)
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];

	@OneToMany(
		() => JobPresetUpworkJobSearchCriterion,
		(jobPresetUpworkJobSearchCriterion) =>
			jobPresetUpworkJobSearchCriterion.jobPreset,
		{
			onDelete: 'CASCADE'
		}
	)
	jobPresetCriterions?: IJobPresetUpworkJobSearchCriterion[];
}
