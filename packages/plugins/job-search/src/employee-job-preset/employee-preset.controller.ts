import {
	Controller,
	HttpStatus,
	Get,
	Query,
	Post,
	Body,
	Param,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import {
	IEmployeePresetInput,
	IEmployeeUpworkJobsSearchCriterion,
	IGetMatchingCriterions,
	IJobPreset,
	IMatchingCriterions
} from '@gauzy/contracts';
import { UUIDValidationPipe } from '@gauzy/core';
import { JobPresetService } from './job-preset.service';
import { JobPreset } from './job-preset.entity';

@ApiTags('EmployeeJobPreset')
@Controller('employee')
export class EmployeePresetController {

	constructor(
		private readonly jobPresetService: JobPresetService
	) { }

	/**
	* Retrieves the job preset for a specific employee.
	*
	* @param employeeId The ID of the employee.
	* @returns The job preset for the specified employee.
	*/
	@ApiOperation({ summary: 'Retrieves the job preset for a specific employee.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':employeeId')
	async getEmployeePreset(
		@Param('employeeId', UUIDValidationPipe) employeeId: string
	): Promise<IJobPreset[]> {
		return await this.jobPresetService.getEmployeePreset(employeeId);
	}

	/**
	* Retrieves all matching criteria for job presets of a specific employee.
	*
	* @param employeeId The ID of the employee.
	* @param request The request containing criteria for matching.
	* @returns The matching criteria for job presets of the specified employee.
	*/
	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found matching criteria for employee job presets',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':employeeId/criterion')
	async getEmployeeCriterion(
		@Param('employeeId', UUIDValidationPipe) employeeId: string,
		@Query() request: IGetMatchingCriterions
	): Promise<IEmployeeUpworkJobsSearchCriterion[]> {
		return await this.jobPresetService.getEmployeeCriterion({
			...request,
			employeeId
		});
	}

	/**
	* Saves or updates matching criteria for job presets of a specific employee.
	*
	* @param employeeId The ID of the employee.
	* @param request The request containing criteria for matching.
	* @returns The saved or updated job presets for the specified employee.
	*/
	@ApiOperation({ summary: 'Save or update employee job presets' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Employee job presets saved or updated successfully',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post(':employeeId/criterion')
	async saveUpdateEmployeeCriterion(
		@Param('employeeId', UUIDValidationPipe) employeeId: string,
		@Body() request: IMatchingCriterions
	): Promise<IJobPreset[]> {
		return await this.jobPresetService.saveEmployeeCriterion({
			...request,
			employeeId
		});
	}

	/**
   * Saves an employee preset.
   *
   * @param request The request containing the employee preset data.
   * @returns The saved employee job preset.
   */
	@ApiOperation({ summary: 'Save Employee preset' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Employee job preset saved successfully',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post()
	async saveEmployeePreset(
		@Body() request: IEmployeePresetInput
	): Promise<IJobPreset[]> {
		return await this.jobPresetService.saveEmployeePreset(request);
	}

	/**
	 * Deletes an employee job preset criterion.
	 *
	 * @param criterionId The ID of the criterion to delete.
	 * @param employeeId The ID of the employee whose criterion to delete.
	 * @returns The deleted employee job preset.
	 */
	@ApiOperation({ summary: 'Delete employee job preset criterion' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Employee job preset criterion deleted successfully',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Delete(':employeeId/criterion/:criterionId')
	async deleteEmployeeCriterion(
		@Param('criterionId', UUIDValidationPipe) criterionId: string,
		@Param('employeeId', UUIDValidationPipe) employeeId: string
	): Promise<DeleteResult> {
		return await this.jobPresetService.deleteEmployeeCriterion(
			criterionId,
			employeeId
		);
	}
}
