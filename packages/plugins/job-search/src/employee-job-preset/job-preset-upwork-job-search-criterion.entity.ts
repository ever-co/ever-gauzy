import { JoinColumn, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import {
	IJobPreset,
	IJobPresetUpworkJobSearchCriterion,
	IJobSearchCategory,
	IJobSearchOccupation,
	JobPostTypeEnum
} from '@gauzy/contracts';
import { MultiORMColumn, MultiORMEntity, MultiORMManyToOne, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmJobPresetUpworkJobSearchCriterionRepository } from './repository/mikro-orm-job-preset-upwork-job-search-criterion.repository';
import { JobPreset } from './job-preset.entity';
import { JobSearchOccupation } from './job-search-occupation/job-search-occupation.entity';
import { JobSearchCategory } from './job-search-category/job-search-category.entity';

@MultiORMEntity('job_preset_upwork_job_search_criterion', { mikroOrmRepository: () => MikroOrmJobPresetUpworkJobSearchCriterionRepository })
export class JobPresetUpworkJobSearchCriterion extends TenantOrganizationBaseEntity implements IJobPresetUpworkJobSearchCriterion {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@MultiORMColumn({ nullable: true })
	keyword?: string;

	@ApiProperty({ type: () => Boolean })
	@IsNotEmpty()
	@IsEnum(JobPostTypeEnum)
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
	@MultiORMManyToOne(() => JobPreset, (it) => it.jobPresetCriterions, {
		/** Indicates if relation column value can be nullable or not. */
		nullable: true
	})
	@JoinColumn()
	jobPreset?: IJobPreset;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: JobPresetUpworkJobSearchCriterion) => it.jobPreset)
	@MultiORMColumn({ relationId: true })
	jobPresetId?: string;

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
	@RelationId((it: JobPresetUpworkJobSearchCriterion) => it.occupation)
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
	@RelationId((it: JobPresetUpworkJobSearchCriterion) => it.category)
	@MultiORMColumn({ nullable: true, relationId: true })
	categoryId?: string;
}
