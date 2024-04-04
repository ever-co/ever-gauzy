import { Controller, UseGuards, HttpStatus, Get, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGetActivitiesInput, IBulkActivitiesInput, ReportGroupFilterEnum, PermissionsEnum } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { ActivityService } from './activity.service';
import { ActivityMapService } from './activity.map.service';
import { ActivityQueryDTO } from './dto/query';

@ApiTags('Activity')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIMESHEET_EDIT_TIME)
@Controller()
export class ActivityController {
	constructor(
		private readonly activityService: ActivityService,
		private readonly activityMapService: ActivityMapService
	) { }

	@ApiOperation({ summary: 'Get Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async getActivities(@Query() options: ActivityQueryDTO) {
		const defaultParams: Partial<IGetActivitiesInput> = {
			page: 0,
			limit: 30
		};
		options = Object.assign({}, defaultParams, options);
		return await this.activityService.getActivities(options);
	}

	@ApiOperation({ summary: 'Get Daily Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('daily')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getDailyActivities(@Query() options: ActivityQueryDTO) {
		return await this.activityService.getDailyActivities(options);
	}

	@ApiOperation({ summary: 'Get Daily Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('report')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getDailyActivitiesReport(@Query() options: ActivityQueryDTO) {
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
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('bulk')
	async bulkSaveActivities(@Body() entities: IBulkActivitiesInput) {
		return await this.activityService.bulkSave(entities);
	}
}
