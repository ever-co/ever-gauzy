import {
	Controller,
	UseGuards,
	Put,
	HttpStatus,
	Body,
	Get,
	Query,
	Param
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
	IUpdateTimesheetStatusInput,
	IGetTimesheetInput,
	ISubmitTimesheetInput,
	ITimesheet,
	PermissionsEnum
} from '@gauzy/contracts';
import { TimeSheetService } from './timesheet.service';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { UUIDValidationPipe } from './../../shared/pipes';
import { Permissions } from './../../shared/decorators';

@ApiTags('TimeSheet')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TimeSheetController {
	constructor(
		private readonly timeSheetService: TimeSheetService
	) {}

	/**
	 * GET all timesheet count in same tenant
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Get timesheet Count' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Get timesheet Count'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/count')
	async getTimesheetCount(
		@Query() entity: IGetTimesheetInput
	): Promise<number> {
		return await this.timeSheetService.getTimeSheetCount(entity);
	}

	/**
	 * UPDATE timesheet status
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Update timesheet' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timesheet has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	@Put('/status')
	async updateTimesheetStatus(
		@Body() entity: IUpdateTimesheetStatusInput
	): Promise<ITimesheet[]> {
		return await this.timeSheetService.updateStatus(entity);
	}

	/**
	 * UPDATE timesheet submit status
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Submit timesheet' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The timesheet has been successfully submit.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	@Put('/submit')
	async submitTimeheet(
		@Body() entity: ISubmitTimesheetInput
	): Promise<ITimesheet[]> {
		return await this.timeSheetService.submitTimeheet(entity);
	}

	/**
	 * GET all timesheet in same tenant
	 * 
	 * @param entity 
	 * @returns 
	 */
	@ApiOperation({ summary: 'Get timesheet' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Get timesheet'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async get(
		@Query() entity: IGetTimesheetInput
	): Promise<ITimesheet[]> {
		return await this.timeSheetService.getTimeSheets(entity);
	}

	@ApiOperation({ summary: 'Find timesheet by id' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found timesheet by id'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.CAN_APPROVE_TIMESHEET)
	@Get('/:id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string
	): Promise<ITimesheet> {
		return this.timeSheetService.findOneByIdString(id);
	}
}
