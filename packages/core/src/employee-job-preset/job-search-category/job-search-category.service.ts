import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from './../../core/crud';
import { JobSearchCategory } from './job-search-category.entity';
import { TypeOrmJobSearchCategoryRepository } from './repository/type-orm-job-search-category.repository';
import { MikroOrmJobSearchCategoryRepository } from './repository/mikro-orm-job-search-category.repository';

@Injectable()
export class JobSearchCategoryService extends TenantAwareCrudService<JobSearchCategory> {
	constructor(
		typeOrmJobSearchCategoryRepository: TypeOrmJobSearchCategoryRepository,
		mikroOrmJobSearchCategoryRepository: MikroOrmJobSearchCategoryRepository
	) {
		super(typeOrmJobSearchCategoryRepository, mikroOrmJobSearchCategoryRepository);
	}
}
