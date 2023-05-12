import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Post,
	Body,
	UsePipes,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	IApplyJobPostInput,
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	IPagination,
	IVisibilityJobPostInput
} from '@gauzy/contracts';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPost } from './employee-job.entity';

@ApiTags('EmployeeJobPost')
@Controller()
export class EmployeeJobPostController {
	constructor(
		private readonly employeeJobPostService: EmployeeJobPostService
	) { }

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
	async findAll(
		@Query() input: IGetEmployeeJobPostInput
	): Promise<IPagination<IEmployeeJobPost>> {
		return await this.employeeJobPostService.findAll(input);
	}

	@ApiOperation({ summary: 'Apply on job' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Applied for employee job',
		type: EmployeeJobPost
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@UsePipes(new ValidationPipe())
	@Post('applied')
	async updateApplied(
		@Body() input: IApplyJobPostInput
	) {
		return await this.employeeJobPostService.updateApplied(input);
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

	/**
	 * Generate employee job proposal
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Generate employee proposal' })
	@Post('generate-proposal')
	async generateProposal(@Body() data: IApplyJobPostInput) {
		return await this.employeeJobPostService.generateEmployeeProposal(data);
	}
}
