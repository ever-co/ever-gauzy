import {
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Query,
	Post,
	Body,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGetActivitiesInput, IBulkActivitiesInput, ReportGroupFilterEnum, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { ActivityService } from './activity.service';
import { ActivityMapService } from './activity.map.service';
import { ActivityQueryDTO } from './dto/query';

@ApiTags('Activity')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller()
export class ActivityController {
	constructor(
		private readonly activityService: ActivityService,
		private readonly activityMapService: ActivityMapService
	) {}

	@ApiOperation({ summary: 'Get Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIMESHEET_EDIT_TIME)
	@Get('/')
	async getActivities(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: ActivityQueryDTO
	) {
		const defaultParams: Partial<IGetActivitiesInput> = {
			page: 0,
			limit: 30
		};
		options = Object.assign({}, defaultParams, options);
		console.log({ options });
		return this.activityService.getActivities(options);
	}

	@ApiOperation({ summary: 'Get Daily Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIMESHEET_EDIT_TIME)
	@Get('/daily')
	async getDailyActivities(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: ActivityQueryDTO
	) {
		return this.activityService.getDailyActivities(options);
	}

	@ApiOperation({ summary: 'Get Daily Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIMESHEET_EDIT_TIME)
	@Get('/report')
	async getDailyActivitiesReport(
		@Query(new ValidationPipe({
			transform: true,
			whitelist: true
		})) options: ActivityQueryDTO
	) {
		let activities = await this.activityService.getDailyActivitiesReport(options);
		if (options.groupBy === ReportGroupFilterEnum.date) {
			activities = this.activityMapService.mapByDate(activities);
		} else if (options.groupBy === ReportGroupFilterEnum.employee) {
			activities = this.activityMapService.mapByEmployee(activities);
		} else if (options.groupBy === ReportGroupFilterEnum.project) {
			activities = this.activityMapService.mapByProject(activities);
		}
		return activities;
	}

	@ApiOperation({ summary: 'Save bulk Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/bulk')
	async bulkSaveActivities(@Body() entities: IBulkActivitiesInput) {
		return this.activityService.bulkSave(entities);
	}
}
