import { Column, Entity, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	IJobPresetUpworkJobSearchCriterion,
	JobPostTypeEnum
} from '@gauzy/contracts';
import { DeepPartial } from '@gauzy/common';
import {
	JobPreset,
	JobSearchCategory,
	JobSearchOccupation,
	TenantOrganizationBaseEntity
} from '../internal';

@Entity('job_preset_upwork_job_search_criterion')
export class JobPresetUpworkJobSearchCriterion
	extends TenantOrganizationBaseEntity
	implements IJobPresetUpworkJobSearchCriterion {
	constructor(input?: DeepPartial<JobPresetUpworkJobSearchCriterion>) {
		super(input);
	}

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
	@Column({ type: 'text', nullable: true })
	jobType?: JobPostTypeEnum;
}
