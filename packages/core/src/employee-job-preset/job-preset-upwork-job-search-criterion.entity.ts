import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import {
	IJobPresetUpworkJobSearchCriterion,
	JobPostTypeEnum
} from '@gauzy/contracts';
import {
	JobPreset,
	JobSearchCategory,
	JobSearchOccupation,
	TenantOrganizationBaseEntity
} from '../core/entities/internal';
import { MultiORMColumn, MultiORMEntity } from './../core/decorators/entity';
import { MikroOrmJobPresetUpworkJobSearchCriterionRepository } from './repository/mikro-orm-job-preset-upwork-job-search-criterion.repository';
import { MultiORMManyToOne } from '../core/decorators/entity/relations';

@MultiORMEntity('job_preset_upwork_job_search_criterion', { mikroOrmRepository: () => MikroOrmJobPresetUpworkJobSearchCriterionRepository })
export class JobPresetUpworkJobSearchCriterion extends TenantOrganizationBaseEntity implements IJobPresetUpworkJobSearchCriterion {

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn()
	jobPresetId?: string;

	@MultiORMManyToOne(() => JobPreset, (jobPreset) => jobPreset.jobPresetCriterions)
	jobPreset?: JobPreset;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: true })
	occupationId?: string;

	@MultiORMManyToOne(
		() => JobSearchOccupation,
		(occupation) => occupation.jobPresetCriterions
	)
	occupation?: JobSearchOccupation;

	@ApiProperty({ type: () => String })
	@IsString()
	@IsNotEmpty()
	@MultiORMColumn({ nullable: true })
	categoryId?: string;

	@MultiORMManyToOne(
		() => JobSearchCategory,
		(category) => category.jobPresetCriterions
	)
	category?: JobSearchCategory;

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
}
