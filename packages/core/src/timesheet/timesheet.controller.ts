import {
	Controller,
	UseGuards,
	Put,
	HttpStatus,
	Body,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';
import {
	IUpdateTimesheetStatusInput,
	IGetTimesheetInput,
	ISubmitTimesheetInput,
	LanguagesEnum
} from '@gauzy/contracts';
import { TimeSheetService } from './timesheet.service';
import { TenantPermissionGuard } from './../shared/guards';

@ApiTags('TimeSheet')
@UseGuards(TenantPermissionGuard)
@Controller()
export class TimeSheetController {
	constructor(
		private readonly timeSheetService: TimeSheetService
	) {}

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
	async get(@Query() entity: IGetTimesheetInput): Promise<any> {
		return await this.timeSheetService.getTimeSheets(entity);
	}
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
	async getTimesheetCount(@Query() entity: IGetTimesheetInput): Promise<any> {
		return await this.timeSheetService.getTimeSheetCount(entity);
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
		@Body() entity: IUpdateTimesheetStatusInput,
		@I18nLang() i18nLang: LanguagesEnum
	): Promise<any> {
		return await this.timeSheetService.updateStatus(entity);
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
		return await this.timeSheetService.submitTimeheet(entity);
	}
}
