import { Column, Index, OneToMany } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
	JobPostSourceEnum,
	IEmployeeUpworkJobsSearchCriterion,
	IJobPresetUpworkJobSearchCriterion,
	IJobSearchCategory
} from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import {
	EmployeeUpworkJobsSearchCriterion,
	JobPresetUpworkJobSearchCriterion,
	TenantOrganizationBaseEntity
} from '../../core/entities/internal';
import { MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmJobSearchCategoryRepository } from './repository/mikro-orm-job-search-category.repository';

@MultiORMEntity('job_search_category', { mikroOrmRepository: () => MikroOrmJobSearchCategoryRepository })
export class JobSearchCategory extends TenantOrganizationBaseEntity implements IJobSearchCategory {

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
	@OneToMany(() => EmployeeUpworkJobsSearchCriterion, (it) => it.category, {
		onDelete: 'CASCADE'
	})
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];

	/**
	 * JobPresetUpworkJobSearchCriterion
	 */
	@OneToMany(() => JobPresetUpworkJobSearchCriterion, (it) => it.category, {
		onDelete: 'CASCADE'
	})
	jobPresetCriterions?: IJobPresetUpworkJobSearchCriterion[];
}
