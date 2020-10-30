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
	IGetMatchingCriterions,
	IMatchingCriterions
} from '@gauzy/models';
import { JobPresetService } from './job-preset.service';
import { JobPreset } from './job-preset.entity';

@ApiTags('EmployeeJobPreset')
@UseGuards(AuthGuard('jwt'))
@Controller('employee')
export class EmployeePresetController {
	constructor(private readonly jobPresetService: JobPresetService) {}

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
	async getEmployeePreset(@Param('employeeId') employeeId: string) {
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
	@Get(':employeeId/criterion')
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
	@Post(':employeeId/criterion')
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
	@Post()
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
	@Delete(':employeeId/criterion/:criterionId')
	async deleteEmployeeCriterion(
		@Param('criterionId') criterionId: string,
		@Param('employeeId') employeeId: string
	) {
		return this.jobPresetService.deleteEmployeeCriterion(
			criterionId,
			employeeId
		);
	}
}
