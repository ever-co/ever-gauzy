import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Post,
	Body,
	Param,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
	IEmployeePresetInput,
	IGetJobPresetCriterionInput,
	IGetJobPresetInput,
	IGetMatchingCriterions,
	IJobPreset,
	IMatchingCriterions
} from '@gauzy/models';
import { JobPresetService } from './job-preset.service';
import { JobPreset } from './job-preset.entity';
import { JobPresetUpworkJobSearchCriterion } from './job-preset-upwork-job-search-criterion.entity';
import { EmployeeUpworkJobsSearchCriterion } from './employee-upwork-jobs-search-criterion.entity';

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
	async getAll(@Query() data: IGetJobPresetInput) {
		return this.jobPresetService.getAll(data);
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
	async get(
		@Param('id') presetId: string,
		@Query() request: IGetJobPresetCriterionInput
	) {
		return this.jobPresetService.get(presetId, request);
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
		@Param('jobPresetId') jobPresetId: string,
		@Body() request: IMatchingCriterions
	) {
		return this.jobPresetService.saveJobPresetCriterion({
			...request,
			jobPresetId
		});
	}

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
	@Get('employee/:id')
	async getEmployeePreset(@Param('id') employeeId: string) {
		return this.jobPresetService.getEmployeePreset(employeeId);
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
	@Get('employee/:employeeId/criterion')
	async getEmployeeCriterion(
		@Param('employeeId') employeeId: string,
		@Query() request: IGetMatchingCriterions
	) {
		return this.jobPresetService.getEmployeeCriterion({
			...request,
			employeeId
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
	@Post('employee/:employeeId/criterion')
	async saveUpdateEmployeeCriterion(
		@Param('employeeId') employeeId: string,
		@Body() request: IMatchingCriterions
	) {
		return this.jobPresetService.saveEmployeeCriterion({
			...request,
			employeeId
		});
	}

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
	@Post('employee')
	async saveEmployeePreset(@Body() request: IEmployeePresetInput) {
		return this.jobPresetService.saveEmployeePreset(request);
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
	@Delete('criterion/:id')
	async delete(@Param() creationId: string, @Query() request) {
		return this.jobPresetService.deleteCriterion(creationId, request);
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
	async getJobPresetCriterion(@Param('id') presetId: string) {
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
}
