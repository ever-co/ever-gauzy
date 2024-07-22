import { Controller, HttpStatus, Get, Query, Post, Body, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import {
	ID,
	IEmployee,
	IEmployeeJobApplication,
	IEmployeeJobApplicationAppliedResult,
	IEmployeeJobPost,
	IGetEmployeeJobPostInput,
	IPagination,
	IUpdateEmployeeJobPostAppliedResult,
	IVisibilityJobPostInput,
	PermissionsEnum
} from '@gauzy/contracts';
import {
	UUIDValidationPipe,
	UseValidationPipe,
	Permissions,
	PaginationParams,
	Employee,
	TenantPermissionGuard,
	PermissionGuard
} from '@gauzy/core';
import { EmployeeJobPostService } from './employee-job.service';
import { EmployeeJobPost } from './employee-job.entity';
import { UpdateEmployeeJobSearchStatusCommand } from './commands';
import { GetEmployeeJobStatisticsQuery } from './queries';
import { EmployeeJobStatisticDTO } from './dto';

@ApiTags('EmployeeJobPost')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/employee-job')
export class EmployeeJobPostController {
	constructor(
		private readonly _employeeJobPostService: EmployeeJobPostService,
		private readonly _commandBus: CommandBus,
		private readonly _queryBus: QueryBus
	) {}

	/**
	 * Find all employee job posts.
	 *
	 * @param input - Query parameters for filtering employee job posts.
	 * @returns A paginated list of employee job posts.
	 */
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
	@Permissions(PermissionsEnum.ORG_JOB_SEARCH)
	@Get('/')
	async findAll(@Query() input: IGetEmployeeJobPostInput): Promise<IPagination<IEmployeeJobPost>> {
		return await this._employeeJobPostService.findAll(input);
	}

	/**
	 * GET employee job statistics.
	 *
	 * This endpoint retrieves statistics related to employee jobs,
	 * providing details about job distribution, assignments, or other related data.
	 *
	 * @param options Pagination parameters for retrieving the data.
	 * @returns A paginated list of employee job statistics.
	 */
	@ApiOperation({ summary: 'Retrieve employee job statistics' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Employee job statistics found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues about what went wrong.'
	})
	@Permissions(PermissionsEnum.ORG_JOB_EMPLOYEE_VIEW)
	@Get('/statistics')
	@UseValidationPipe({ transform: true })
	async getEmployeeJobsStatistics(@Query() query: PaginationParams<Employee>): Promise<IPagination<IEmployee>> {
		return await this._queryBus.execute(new GetEmployeeJobStatisticsQuery(query));
	}

	/**
	 * UPDATE employee's job search status by their IDs
	 *
	 * This endpoint allows updating the job search status of an employee, given their ID.
	 *
	 * @param employeeId The unique identifier of the employee whose job search status is being updated.
	 * @param entity The updated job search status information.
	 * @returns A promise resolving to the updated employee record or an update result.
	 */
	@ApiOperation({ summary: 'Update Job Search Status' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Job search status has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input. The response body may contain clues as to what went wrong.'
	})
	@Permissions(PermissionsEnum.ORG_EMPLOYEES_EDIT, PermissionsEnum.PROFILE_EDIT)
	@Put('/:id/job-search-status')
	@UseValidationPipe({ whitelist: true })
	async updateJobSearchStatus(
		@Param('id', UUIDValidationPipe) employeeId: ID,
		@Body() input: EmployeeJobStatisticDTO
	): Promise<IEmployee | UpdateResult> {
		return await this._commandBus.execute(new UpdateEmployeeJobSearchStatusCommand(employeeId, input));
	}

	/**
	 * Apply for a job.
	 *
	 * @param input - The input for the job application.
	 * @returns A promise that resolves to the applied job post details.
	 */
	@ApiOperation({ summary: 'Apply for a Job' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Apply for a Job',
		type: EmployeeJobPost
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_JOB_APPLY)
	@Post('/apply')
	@UseValidationPipe() // Assuming ValidationPipe is configured appropriately
	async apply(@Body() input: IEmployeeJobApplication): Promise<IEmployeeJobApplicationAppliedResult | null> {
		try {
			// Apply for the job using the service
			const appliedJobPost = await this._employeeJobPostService.apply(input);

			// If needed, perform additional logic here
			return appliedJobPost;
		} catch (error) {
			// Handle or log the error, depending on your application's needs
			console.error('Error applying for a job:', error);

			// Return null or a custom error response
			return null;
		}
	}

	/**
	 * Update the status of a job application.
	 *
	 * @param input - The input for updating the job application.
	 * @returns A promise that resolves to the updated job post details.
	 */
	@ApiOperation({ summary: 'Update applied for a job' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update applied for a job',
		type: EmployeeJobPost
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_JOB_APPLY)
	@Post('/updateApplied')
	@UseValidationPipe() // Assuming ValidationPipe is configured appropriately
	async updateApplied(@Body() input: IEmployeeJobApplication): Promise<IUpdateEmployeeJobPostAppliedResult | null> {
		try {
			// Update the job application status using the service
			const updatedJobPost = await this._employeeJobPostService.updateApplied(input);

			// If needed, perform additional logic here

			return updatedJobPost;
		} catch (error) {
			// Handle or log the error, depending on your application's needs
			console.error('Error updating applied for a job:', error);

			// Return null or a custom error response
			return null;
		}
	}

	/**
	 * Update the visibility status for a job.
	 *
	 * @param data - The input for updating the job visibility.
	 * @returns A promise that resolves to the updated job post details.
	 */
	@ApiOperation({ summary: 'Hide job' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update visibility for a job',
		type: EmployeeJobPost
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post('/hide')
	@Permissions(PermissionsEnum.ORG_JOB_EDIT)
	@UseValidationPipe() // Assuming ValidationPipe is configured appropriately
	async updateVisibility(@Body() data: IVisibilityJobPostInput): Promise<boolean | null> {
		try {
			// Update the job visibility status using the service
			const updatedJobPost = await this._employeeJobPostService.updateVisibility(data);

			// If needed, perform additional logic here

			return updatedJobPost;
		} catch (error) {
			// Handle or log the error, depending on your application's needs
			console.error(error);

			// Return null or a custom error response
			return null;
		}
	}

	/**
	 * Create a preliminary record for an employee job application.
	 *
	 * @param input - The input for creating the preliminary job application record.
	 * @returns A promise that resolves to the partial details of the created job application.
	 */
	@ApiOperation({ summary: 'Create employee job application record' })
	@Permissions(PermissionsEnum.ORG_JOB_APPLY)
	@Post('/pre-process')
	async preProcessEmployeeJobApplication(
		@Body() input: IEmployeeJobApplication
	): Promise<Partial<IEmployeeJobApplication> | null> {
		try {
			// Validate the input structure if needed

			// Create a preliminary employee job application record using the service
			const createdJobApplication = await this._employeeJobPostService.preProcessEmployeeJobApplication(input);

			// If needed, perform additional logic here

			return createdJobApplication;
		} catch (error) {
			// Handle or log the error, depending on your application's needs
			console.error('Error pre-processing employee job application:', error);

			// Return null or a custom error response
			return null;
		}
	}

	/**
	 * Get AI-generated proposal for an employee job application.
	 *
	 * @param employeeJobApplicationId - The ID of the employee job application.
	 * @returns A promise that resolves to the AI-generated proposal details.
	 */
	@ApiOperation({
		summary: 'Get AI generated proposal for employee job application.'
	})
	@Permissions(PermissionsEnum.ORG_JOB_APPLY)
	@Get('/application/:employeeJobApplicationId')
	async getEmployeeJobApplication(
		@Param('employeeJobApplicationId', UUIDValidationPipe) employeeJobApplicationId: ID
	): Promise<void | null> {
		try {
			// Retrieve AI-generated proposal for the employee job application using the service
			const proposal = await this._employeeJobPostService.getEmployeeJobApplication(employeeJobApplicationId);

			// If needed, perform additional logic here

			return proposal;
		} catch (error) {
			// Handle or log the error, depending on your application's needs
			console.log('Error retrieving employee job application:', error);

			// Return null or a custom error response
			return null;
		}
	}

	/**
	 * Generate AI proposal for an employee job application.
	 *
	 * @param employeeJobApplicationId - The ID of the employee job application.
	 * @returns A promise that resolves to the generated AI proposal details.
	 */
	@ApiOperation({
		summary: 'Generate AI proposal for employee job application'
	})
	@Permissions(PermissionsEnum.ORG_JOB_APPLY)
	@Post('/generate-proposal/:employeeJobApplicationId')
	async generateAIProposal(
		@Param('employeeJobApplicationId', UUIDValidationPipe) employeeJobApplicationId: string
	): Promise<void | null> {
		try {
			// Generate AI proposal for the employee job application using the service
			const aiProposal = await this._employeeJobPostService.generateAIProposal(employeeJobApplicationId);

			// If needed, perform additional logic here

			return aiProposal;
		} catch (error) {
			// Handle or log the error, depending on your application's needs
			console.log('Error generating AI proposal for employee job application:', error);

			// Return null or a custom error response
			return null;
		}
	}
}
