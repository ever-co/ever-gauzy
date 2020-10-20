import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CrudController } from '../core';
import { JobPost } from './jobPost.entity';
import { JobPostService } from './jobPost.service';
import { Query } from '@nestjs/common';

@ApiTags('JobPost')
@Controller()
export class JobPostController extends CrudController<JobPost> {
	constructor(private readonly jobPostService: JobPostService) {
		super(jobPostService);
	}

	@Get('graphql')
	async findRecords(
		@Query('employeeId') employeeId: string
	): Promise<JobPost> {
		return this.jobPostService.findAllRecord(employeeId);
	}
}
