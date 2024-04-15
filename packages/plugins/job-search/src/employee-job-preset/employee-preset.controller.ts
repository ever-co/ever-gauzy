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
import {
	IEmployeePresetInput,
	IGetMatchingCriterions,
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
	 *
	 * @param employeeId
	 * @returns
	 */
	@ApiOperation({ summary: 'Save Employee preset' })
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
	) {
		return await this.jobPresetService.getEmployeePreset(employeeId);
	}

	/**
	 *
	 * @param employeeId
	 * @param request
	 * @returns
	 */
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
	@Get(':employeeId/criterion')
	async getEmployeeCriterion(
		@Param('employeeId', UUIDValidationPipe) employeeId: string,
		@Query() request: IGetMatchingCriterions
	) {
		return await this.jobPresetService.getEmployeeCriterion({
			...request,
			employeeId
		});
	}

	/**
	 *
	 * @param employeeId
	 * @param request
	 * @returns
	 */
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
	@Post(':employeeId/criterion')
	async saveUpdateEmployeeCriterion(
		@Param('employeeId', UUIDValidationPipe) employeeId: string,
		@Body() request: IMatchingCriterions
	) {
		return await this.jobPresetService.saveEmployeeCriterion({
			...request,
			employeeId
		});
	}

	/**
	 *
	 * @param request
	 * @returns
	 */
	@ApiOperation({ summary: 'Save Employee preset' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: JobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Post()
	async saveEmployeePreset(
		@Body() request: IEmployeePresetInput
	) {
		return await this.jobPresetService.saveEmployeePreset(request);
	}

	/**
	 *
	 * @param criterionId
	 * @param employeeId
	 * @returns
	 */
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
	@Delete(':employeeId/criterion/:criterionId')
	async deleteEmployeeCriterion(
		@Param('criterionId', UUIDValidationPipe) criterionId: string,
		@Param('employeeId', UUIDValidationPipe) employeeId: string
	) {
		return await this.jobPresetService.deleteEmployeeCriterion(
			criterionId,
			employeeId
		);
	}
}
