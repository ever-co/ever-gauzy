import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { JobSearchCategory } from './job-search-category.entity';
import { MikroOrmJobSearchCategoryRepository } from './repository/mikro-orm-job-search-category.repository';
import { TypeOrmJobSearchCategoryRepository } from './repository/type-orm-job-search-category.repository';

@Injectable()
export class JobSearchCategoryService extends TenantAwareCrudService<JobSearchCategory> {
	constructor(
		typeOrmJobSearchCategoryRepository: TypeOrmJobSearchCategoryRepository,
		mikroOrmJobSearchCategoryRepository: MikroOrmJobSearchCategoryRepository
	) {
		super(typeOrmJobSearchCategoryRepository, mikroOrmJobSearchCategoryRepository);
	}
}
