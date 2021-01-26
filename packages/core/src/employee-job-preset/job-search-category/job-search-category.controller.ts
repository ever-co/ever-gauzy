import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrudController } from '../../core/crud/crud.controller';
import { JobSearchCategory } from './job-search-category.entity';
import { JobSearchCategoryService } from './job-search-category.service';

@ApiTags('JobSearchCategory')
@UseGuards(AuthGuard('jwt'))
@Controller('job-search-category')
export class JobSearchCategoryController extends CrudController<JobSearchCategory> {
	constructor(categoryService: JobSearchCategoryService) {
		super(categoryService);
	}
}
