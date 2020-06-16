import {
	Controller,
	UseGuards,
	Put,
	HttpStatus,
	Body,
	Get,
	Query
} from '@nestjs/common';
import { Timesheet } from '../timesheet.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { TimeSheetService } from './timesheet.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
	IUpdateTimesheetStatusInput,
	IGetTimeSheetInput,
	ISubmitTimesheetInput
} from '@gauzy/models';

@ApiTags('TimeSheet')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class TimeSheetController extends CrudController<Timesheet> {
	constructor(private readonly timeSheetService: TimeSheetService) {
		super(timeSheetService);
	}

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
	// @UseGuards(OrganizationPermissionGuard)
	// @Permissions(OrganizationPermissionsEnum.ALLOW_MODIFY_TIME)
	async get(@Query() entity: IGetTimeSheetInput): Promise<any> {
		return this.timeSheetService.getTimeSheets(entity);
	}

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
	@Put('/status')
	// @UseGuards(OrganizationPermissionGuard)
	// @Permissions(OrganizationPermissionsEnum.ALLOW_MODIFY_TIME)
	async updateStatus(
		@Body() entity: IUpdateTimesheetStatusInput
	): Promise<any> {
		return this.timeSheetService.updateStatus(entity);
	}

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
	@Put('/submit')
	async submitTimeheet(@Body() entity: ISubmitTimesheetInput): Promise<any> {
		return this.timeSheetService.submitTimeheet(entity);
	}
}
