import { Column, ManyToOne, RelationId } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, IsUUID } from 'class-validator';
import {
	IJobPreset,
	IJobPresetUpworkJobSearchCriterion,
	IJobSearchCategory,
	IJobSearchOccupation,
	JobPostTypeEnum
} from '@gauzy/contracts';
import {
	JobPreset,
	JobSearchCategory,
	JobSearchOccupation,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmJobPresetUpworkJobSearchCriterionRepository } from './repository/mikro-orm-job-preset-upwork-job-search-criterion.repository';

@MultiORMEntity('job_preset_upwork_job_search_criterion', { mikroOrmRepository: () => MikroOrmJobPresetUpworkJobSearchCriterionRepository })
export class JobPresetUpworkJobSearchCriterion extends TenantOrganizationBaseEntity implements IJobPresetUpworkJobSearchCriterion {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Column({ nullable: true })
	keyword?: string;

	@ApiProperty({ type: () => Boolean })
	@IsNotEmpty()
	@IsEnum(JobPostTypeEnum)
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
	@ManyToOne(() => JobPreset, (it) => it.jobPresetCriterions)
	jobPreset?: IJobPreset;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: JobPresetUpworkJobSearchCriterion) => it.jobPreset)
	@Column()
	jobPresetId?: string;

	/**
	 *
	 */
	@ManyToOne(() => JobSearchOccupation, (it) => it.jobPresetCriterions)
	occupation?: IJobSearchOccupation;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: JobPresetUpworkJobSearchCriterion) => it.occupation)
	@Column({ nullable: true })
	occupationId?: string;

	/**
	 *
	 */
	@ManyToOne(() => JobSearchCategory, (it) => it.jobPresetCriterions)
	category?: IJobSearchCategory;

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsUUID()
	@RelationId((it: JobPresetUpworkJobSearchCriterion) => it.category)
	@Column({ nullable: true })
	categoryId?: string;
}
