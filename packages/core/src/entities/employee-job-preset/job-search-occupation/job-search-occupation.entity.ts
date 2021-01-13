import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	JobPostSourceEnum,
	IJobSearchOccupation,
	IJobPresetUpworkJobSearchCriterion,
	IEmployeeUpworkJobsSearchCriterion
} from '@gauzy/common';
import { TenantOrganizationBase } from '../../tenant-organization-base';
import { JobPresetUpworkJobSearchCriterion } from '../job-preset-upwork-job-search-criterion.entity';
import { EmployeeUpworkJobsSearchCriterion } from '../employee-upwork-jobs-search-criterion.entity';

@Entity('job_search_occupation')
export class JobSearchOccupation
	extends TenantOrganizationBase
	implements IJobSearchOccupation {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column()
	name?: string;

	// Id of occupation in the job source (e.g. Upwork)
	@ApiProperty({ type: String })
	@IsString()
	@Index()
	@Column({ nullable: true })
	jobSourceOccupationId?: string;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Index()
	@Column({ type: 'text', default: JobPostSourceEnum.UPWORK })
	jobSource?: JobPostSourceEnum;

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
