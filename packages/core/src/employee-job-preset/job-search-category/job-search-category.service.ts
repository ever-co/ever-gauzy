import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { JobSearchCategory } from './job-search-category.entity';
import { TypeOrmJobSearchCategoryRepository } from './repository/type-orm-job-search-category.repository';
import { MikroOrmJobSearchCategoryRepository } from './repository/mikro-orm-job-search-category.repository';

@Injectable()
export class JobSearchCategoryService extends TenantAwareCrudService<JobSearchCategory> {

	constructor(
		@InjectRepository(JobSearchCategory)
		typeOrmJobSearchCategoryRepository: TypeOrmJobSearchCategoryRepository,

		mikroOrmJobSearchCategoryRepository: MikroOrmJobSearchCategoryRepository
	) {
		super(typeOrmJobSearchCategoryRepository, mikroOrmJobSearchCategoryRepository);
	}
}
