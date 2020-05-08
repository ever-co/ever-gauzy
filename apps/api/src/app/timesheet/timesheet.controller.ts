import {
	Controller,
	UseGuards,
	Put,
	HttpStatus,
	Body,
	Get,
	Query
} from '@nestjs/common';
import { Timesheet } from './timesheet.entity';
import { CrudController } from '../core/crud/crud.controller';
import { TimeSheetService } from './timesheet.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import {
	RolesEnum,
	IUpdateTimesheetStatusInput,
	IGetTimeSheetInput
} from '@gauzy/models';
import { UserRole } from '../shared/decorators/roles';

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
	async get(
		@Query() entity: IGetTimeSheetInput,
		@UserRole() roles: RolesEnum
	): Promise<any> {
		console.log(entity);
		return this.timeSheetService.getTimeSheets(entity, roles);
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
}
