import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	JobPostSourceEnum,
	JobSearchOccupation as IJobSearchOccupation
} from '@gauzy/models';
import { TenantOrganizationBase } from '../../core/entities/tenant-organization-base';
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
	employeeCriterions?: EmployeeUpworkJobsSearchCriterion[];

	@OneToMany(
		() => JobPresetUpworkJobSearchCriterion,
		(jobPresetUpworkJobSearchCriterion) =>
			jobPresetUpworkJobSearchCriterion.jobPreset,
		{
			onDelete: 'CASCADE'
		}
	)
	jobPresetCriterions?: JobPresetUpworkJobSearchCriterion[];
}
