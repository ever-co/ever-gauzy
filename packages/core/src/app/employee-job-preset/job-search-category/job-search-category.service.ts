import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../../core/crud/crud.service';
import { JobSearchCategory } from './job-search-category.entity';

@Injectable()
export class JobSearchCategoryService extends CrudService<JobSearchCategory> {
	constructor(
		@InjectRepository(JobSearchCategory)
		categoryRepository: Repository<JobSearchCategory>
	) {
		super(categoryRepository);
	}
}
