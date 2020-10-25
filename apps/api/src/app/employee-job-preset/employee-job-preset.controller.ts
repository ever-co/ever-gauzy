import { Controller, HttpStatus, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { GetJobPresetCriterionInput, GetJobPresetInput } from '@gauzy/models';
import { JobPresetService } from './job-preset.service';
import { JobPreset } from './job-preset.entity';
import { EmployeeJobPreset } from './employee-job-preset.entity';

@ApiTags('EmployeeJobPreset')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class EmployeeJobPresetController {
	constructor(private readonly jobPresetService: JobPresetService) {}

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
	async jobPreset(@Query() data: GetJobPresetInput) {
		return this.jobPresetService.getAll(data);
	}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: EmployeeJobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee')
	async getJobPresetCriterion(
		@Query() { presetId }: GetJobPresetCriterionInput
	) {
		return this.jobPresetService.getJobPresetCriterion(presetId);
	}

	@ApiOperation({ summary: 'Find all employee job posts' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found employee job preset',
		type: EmployeeJobPreset
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('employee')
	async getJobPresetEmployeeCriterion(
		@Query() { employeeId, presetId }: GetJobPresetCriterionInput
	) {
		return this.jobPresetService.getJobPresetEmployeeCriterion(
			presetId,
			employeeId
		);
	}
}
