import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeepPartial } from 'typeorm';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JobPostSourceEnum, IJobSearchCategory } from '@gauzy/contracts';
import { isMySQL } from '@gauzy/config';
import { ColumnIndex, MultiORMColumn, MultiORMEntity, TenantOrganizationBaseEntity } from '@gauzy/core';
import { MikroOrmJobSearchCategoryRepository } from './repository/mikro-orm-job-search-category.repository';

@MultiORMEntity('job_search_category', { mikroOrmRepository: () => MikroOrmJobSearchCategoryRepository })
export class JobSearchCategory extends TenantOrganizationBaseEntity implements IJobSearchCategory {

	constructor(input?: DeepPartial<JobSearchCategory>) {
		super(input);
	}

	@ApiProperty({ type: () => String })
	@IsNotEmpty()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn()
	name?: string;

	// Id of category in the job source (e.g. upwork)
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@ColumnIndex()
	@MultiORMColumn({ nullable: true })
	jobSourceCategoryId?: string;

	@ApiProperty({ type: () => String, enum: JobPostSourceEnum })
	@IsNotEmpty()
	@IsEnum(JobPostSourceEnum)
	@ColumnIndex()
	@MultiORMColumn({
		default: JobPostSourceEnum.UPWORK,
		...(isMySQL() ? { type: 'enum', enum: JobPostSourceEnum } : { type: 'text' })
	})
	jobSource?: JobPostSourceEnum;
}
