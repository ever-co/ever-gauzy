import { Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
	JobPostSourceEnum,
	IJobPreset,
	IEmployeeUpworkJobsSearchCriterion,
	IJobPresetUpworkJobSearchCriterion
} from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import {
	EmployeeUpworkJobsSearchCriterion,
	JobPresetUpworkJobSearchCriterion,
	TenantOrganizationBaseEntity
} from '../../core/entities/internal';
import { MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmJobSearchCategoryRepository } from './repository/mikro-orm-job-search-category.repository';
import { MultiORMOneToMany } from '../../core/decorators/entity/relations';

@MultiORMEntity('job_search_category', { mikroOrmRepository: () => MikroOrmJobSearchCategoryRepository })
export class JobSearchCategory extends TenantOrganizationBaseEntity implements IJobPreset {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	name?: string;

	// Id of category in the job source (e.g. upwork)
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	jobSourceCategoryId?: string;

	@ApiProperty({ type: () => String, enum: JobPostSourceEnum })
	@IsNotEmpty()
	@IsEnum(JobPostSourceEnum)
	@Index()
	@Column({
		default: JobPostSourceEnum.UPWORK,
		...(isMySQL() ? { type: 'enum', enum: JobPostSourceEnum } : { type: 'text' })
	})
	jobSource?: JobPostSourceEnum;

	/*
	|--------------------------------------------------------------------------
	| @OneToMany
	|--------------------------------------------------------------------------
	*/

	/**
	 * EmployeeUpworkJobsSearchCriterion
	 */
	@ApiProperty({ type: () => EmployeeUpworkJobsSearchCriterion, isArray: true })
	@MultiORMOneToMany(() => EmployeeUpworkJobsSearchCriterion, (it) => it.jobPreset, {
		onDelete: 'CASCADE'
	})
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];

	/**
	 * JobPresetUpworkJobSearchCriterion
	 */
	@ApiProperty({ type: () => JobPresetUpworkJobSearchCriterion, isArray: true })
	@MultiORMOneToMany(() => JobPresetUpworkJobSearchCriterion, (it) => it.jobPreset, {
		onDelete: 'CASCADE'
	})
	jobPresetCriterions?: IJobPresetUpworkJobSearchCriterion[];
}
