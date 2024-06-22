import { Controller, HttpStatus, Get, Query, Post, Body, Param, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGetJobPresetCriterionInput, IJobPreset, IMatchingCriterions } from '@gauzy/contracts';
import { i4netAIService } from '@gauzy/integration-ai';
import { EmployeeService, UUIDValidationPipe, UseValidationPipe } from '@gauzy/core';
import { JobPresetService } from './job-preset.service';
import { JobPreset } from './job-preset.entity';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { JobPresetQueryDTO } from './dto';

@ApiTags('JobSearchPreset')
@Controller()
export class JobSearchPresetController {
	constructor(
		private readonly jobPresetService: JobPresetService,
		private readonly employeeService: EmployeeService,
		private readonly gauzyAIService: i4netAIService
	) { }

	/**
	 * Retrieves all employee job presets.
	 *
	 * @param input The query parameters for filtering job presets.
	 * @returns A Promise that resolves to the retrieved job presets.
	 */
	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job presets',
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

		// Synchronize all active employees
		const employees = await this.employeeService.findAllActive();
		await this.gauzyAIService.syncEmployees(employees);

		// Retrieve all job presets based on the provided query parameters
		return await this.jobPresetService.getAll(input);
	}

	/**
	 * Retrieves an employee job preset by its ID.
	 *
	 * @param presetId The ID of the job preset to retrieve.
	 * @param request The query parameters for filtering job presets.
	 * @returns A Promise that resolves to the retrieved job preset.
	 */
	@ApiOperation({ summary: 'Find an employee job preset by ID' })
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
	async get(
		@Param('id', UUIDValidationPipe) presetId: string,
		@Query() request: IGetJobPresetCriterionInput
	) {
		return await this.jobPresetService.get(presetId, request);
	}

	/**
	 * Retrieves job preset criteria for a specific job preset by its ID.
	 *
	 * @param presetId The ID of the job preset for which to retrieve criteria.
	 * @returns A Promise that resolves to the job preset criteria.
	 */
	@ApiOperation({ summary: 'Find job preset criteria by job preset ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found job preset criteria',
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

	/**
	 * Creates a new job preset.
	 *
	 * @param request The job preset data.
	 * @returns A Promise that resolves to the created job preset.
	 */
	@ApiOperation({ summary: 'Create a new job preset' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job preset created successfully',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid job preset data'
	})
	@Post()
	async createJobPreset(@Body() request: IJobPreset) {
		return this.jobPresetService.createJobPreset(request);
	}

	/**
	 * Saves or updates job preset criteria for a specific job preset.
	 *
	 * @param jobPresetId The ID of the job preset.
	 * @param request The criteria data to save or update.
	 * @returns A Promise that resolves to the saved or updated job preset criteria.
	 */
	@ApiOperation({ summary: 'Save or update job preset criteria' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job preset criteria saved or updated successfully',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid job preset criteria data'
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

	/**
	 * Deletes a job preset criterion by its ID.
	 *
	 * @param criterionId The ID of the job preset criterion to delete.
	 * @returns A Promise that resolves to the deleted job preset criterion.
	 */
	@ApiOperation({ summary: 'Delete job preset criterion by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Job preset criterion deleted successfully',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Job preset criterion not found'
	})
	@Delete('criterion/:criterionId')
	async deleteJobPresetCriterion(@Param('criterionId', UUIDValidationPipe) criterionId: string) {
		return this.jobPresetService.deleteJobPresetCriterion(criterionId);
	}
}
