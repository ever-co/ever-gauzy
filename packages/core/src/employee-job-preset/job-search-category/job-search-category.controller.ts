import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../../core/crud';
import { JobSearchCategory } from './job-search-category.entity';
import { JobSearchCategoryService } from './job-search-category.service';

@ApiTags('JobSearchCategory')
@Controller('job-search-category')
export class JobSearchCategoryController extends CrudController<JobSearchCategory> {
	constructor(private readonly jobSearchCategoryService: JobSearchCategoryService) {
		super(jobSearchCategoryService);
	}
}
