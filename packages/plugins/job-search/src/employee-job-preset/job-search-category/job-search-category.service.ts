import { Injectable } from '@nestjs/common';
import { TenantAwareCrudService } from '@gauzy/core';
import { JobSearchCategory } from './job-search-category.entity';
import { MikroOrmJobSearchCategoryRepository, TypeOrmJobSearchCategoryRepository } from './repository';

@Injectable()
export class JobSearchCategoryService extends TenantAwareCrudService<JobSearchCategory> {
	constructor(
		typeOrmJobSearchCategoryRepository: TypeOrmJobSearchCategoryRepository,
		mikroOrmJobSearchCategoryRepository: MikroOrmJobSearchCategoryRepository
	) {
		super(typeOrmJobSearchCategoryRepository, mikroOrmJobSearchCategoryRepository);
	}
}
