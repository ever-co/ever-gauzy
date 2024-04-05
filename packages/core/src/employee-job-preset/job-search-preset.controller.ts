import { Controller, HttpStatus, Get, Query, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGetJobPresetCriterionInput, IJobPreset, IMatchingCriterions } from '@gauzy/contracts';
import { GauzyAIService } from '@gauzy/integration-ai';
import { JobPresetService } from './job-preset.service';
import { JobPreset } from './job-preset.entity';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';
import { EmployeeService } from '../employee/employee.service';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { JobPresetQueryDTO } from './dto';

@ApiTags('JobSearchPreset')
@Controller()
export class JobSearchPresetController {
	constructor(
		private readonly jobPresetService: JobPresetService,
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: GauzyAIService
	) {}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	@UseValidationPipe({ whitelist: true })
	async getAll(@Query() input: JobPresetQueryDTO) {
		console.log('GetAll Presets called. We will sync all employees now');

		// TODO: we can actually sync just for one employee if data.employeeId is defined

		const employees = await this.employeeService.findAllActive();

		await this.gauzyAIService.syncEmployees(employees);

		return await this.jobPresetService.getAll(input);
	}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async get(@Param('id', UUIDValidationPipe) presetId: string, @Query() request: IGetJobPresetCriterionInput) {
		return this.jobPresetService.get(presetId, request);
	}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: JobPresetUpworkJobSearchCriterion
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id/criterion')
	async getJobPresetCriterion(@Param('id', UUIDValidationPipe) presetId: string) {
		return this.jobPresetService.getJobPresetCriterion(presetId);
	}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: EmployeeUpworkJobsSearchCriterion
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post()
	async createJobPreset(@Body() request: IJobPreset) {
		return this.jobPresetService.createJobPreset(request);
	}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post(':jobPresetId/criterion')
	async saveUpdate(
		@Param('jobPresetId', UUIDValidationPipe) jobPresetId: string,
		@Body() request: IMatchingCriterions
	) {
		return this.jobPresetService.saveJobPresetCriterion({
			...request,
			jobPresetId
		});
	}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete('criterion/:criterionId')
	async deleteJobPresetCriterion(@Param('criterionId', UUIDValidationPipe) creationId: string) {
		return this.jobPresetService.deleteJobPresetCriterion(creationId);
	}
}
