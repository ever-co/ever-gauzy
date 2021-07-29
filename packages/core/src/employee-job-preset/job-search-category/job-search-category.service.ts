import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantAwareCrudService } from './../../core/crud';
import { JobSearchCategory } from './job-search-category.entity';

@Injectable()
export class JobSearchCategoryService extends TenantAwareCrudService<JobSearchCategory> {
	constructor(
		@InjectRepository(JobSearchCategory)
		categoryRepository: Repository<JobSearchCategory>
	) {
		super(categoryRepository);
	}
}
