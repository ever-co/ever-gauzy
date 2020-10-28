import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IJobPresetUpworkJobSearchCriterion } from '@gauzy/models';
import { TenantOrganizationBase } from '../core/entities/tenant-organization-base';
import { JobPreset } from './job-preset.entity';
import { JobSearchCategory } from './job-search-category/job-search-category.entity';
import { JobSearchOccupation } from './job-search-occupation/job-search-occupation.entity';

@Entity('job_preset_upwork_job_search_criterion')
export class JobPresetUpworkJobSearchCriterion
	extends TenantOrganizationBase
	implements IJobPresetUpworkJobSearchCriterion {
	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column()
	jobPresetId?: string;

	@ManyToOne(() => JobPreset, (jobPreset) => jobPreset.jobPresetCriterions)
	jobPreset?: JobPreset;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	occupationId?: string;

	@ManyToOne(
		() => JobSearchOccupation,
		(occupation) => occupation.jobPresetCriterions
	)
	occupation?: JobSearchOccupation;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	categoryId?: string;

	@ManyToOne(
		() => JobSearchCategory,
		(category) => category.jobPresetCriterions
	)
	category?: JobSearchCategory;

	@ApiProperty({ type: String })
	@IsString()
	@IsNotEmpty()
	@Column({ nullable: true })
	keyword?: string;

	@ApiProperty({ type: Boolean })
	@IsString()
	@IsNotEmpty()
	@Column({ default: false })
	hourly?: boolean;

	@ApiProperty({ type: Boolean })
	@IsString()
	@IsNotEmpty()
	@Column({ default: false })
	fixPrice?: boolean;
}
