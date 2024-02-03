import { Column, Index } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
	JobPostSourceEnum,
	IJobSearchOccupation,
	IJobPresetUpworkJobSearchCriterion,
	IEmployeeUpworkJobsSearchCriterion
} from '@gauzy/contracts';
import { isMySQL } from "@gauzy/config";
import {
	EmployeeUpworkJobsSearchCriterion,
	JobPresetUpworkJobSearchCriterion,
	TenantOrganizationBaseEntity
} from '../../core/entities/internal';
import { MultiORMEntity } from './../../core/decorators/entity';
import { MikroOrmJobSearchOccupationRepository } from './repository/mikro-orm-job-search-occupation.repository';
import { MultiORMOneToMany } from '../../core/decorators/entity/relations';

@MultiORMEntity('job_search_occupation', { mikroOrmRepository: () => MikroOrmJobSearchOccupationRepository })
export class JobSearchOccupation extends TenantOrganizationBaseEntity implements IJobSearchOccupation {

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@Index()
	@Column()
	name?: string;

	// Id of occupation in the job source (e.g. upwork)
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@Index()
	@Column({ nullable: true })
	jobSourceOccupationId?: string;

	@ApiProperty({ type: () => String, enum: JobPostSourceEnum })
	@IsNotEmpty()
	@IsEnum(JobPostSourceEnum)
	@Index()
	@Column({
		default: JobPostSourceEnum.UPWORK,
		...(isMySQL() ?
			{ type: 'enum', enum: JobPostSourceEnum }
			: { type: 'text' }
		)
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
	@ApiPropertyOptional({ type: () => EmployeeUpworkJobsSearchCriterion, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => EmployeeUpworkJobsSearchCriterion, (it) => it.jobPreset, {
		onDelete: 'CASCADE'
	})
	employeeCriterions?: IEmployeeUpworkJobsSearchCriterion[];

	/**
	 * JobPresetUpworkJobSearchCriterion
	 */
	@ApiPropertyOptional({ type: () => JobPresetUpworkJobSearchCriterion, isArray: true })
	@IsOptional()
	@MultiORMOneToMany(() => JobPresetUpworkJobSearchCriterion, (it) => it.jobPreset, {
		onDelete: 'CASCADE'
	})
	jobPresetCriterions?: IJobPresetUpworkJobSearchCriterion[];
}
