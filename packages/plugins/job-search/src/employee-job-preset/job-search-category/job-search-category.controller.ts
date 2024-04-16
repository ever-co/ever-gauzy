import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '@gauzy/core';
import { JobSearchCategory } from './job-search-category.entity';
import { JobSearchCategoryService } from './job-search-category.service';

@ApiTags('JobSearchCategory')
@Controller('job-search-category')
export class JobSearchCategoryController extends CrudController<JobSearchCategory> {
	constructor(protected readonly jobSearchCategoryService: JobSearchCategoryService) {
		super(jobSearchCategoryService);
	}
}
