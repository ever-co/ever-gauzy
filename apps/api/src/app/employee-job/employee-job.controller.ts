import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPost } from './employee-job.entity';
import { IPagination } from '../core';
import { AuthGuard } from '@nestjs/passport';
import {
	IApplyJobPostInput,
	IGetEmployeeJobPostInput,
	IVisibilityJobPostInput
} from '@gauzy/models';

@ApiTags('EmployeeJobPost')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EmployeeJobPostController {
	constructor(
		private readonly employeeJobPostService: EmployeeJobPostService
	) {}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job posts',
		type: EmployeeJobPost
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAllEmployeesJobs(
		@Query() data: IGetEmployeeJobPostInput
	): Promise<IPagination<EmployeeJobPost>> {
		// detect here what organization selected and what employee (optional) and query only for relevant jobs
		// const organizationId = ...
		// const employeeId = ... (note: can be not set, so we get all jobs)

		return this.employeeJobPostService.findAll(data);
	}

	@ApiOperation({ summary: 'Apply on job' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job posts',
		type: EmployeeJobPost
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post('applied')
	async updateApplied(@Body() data: IApplyJobPostInput) {
		return this.employeeJobPostService.updateApplied(data);
	}

	@ApiOperation({ summary: 'Hide job' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job posts',
		type: EmployeeJobPost
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post('hide')
	async updateVisibility(@Body() data: IVisibilityJobPostInput) {
		return this.employeeJobPostService.updateVisibility(data);
	}
}
