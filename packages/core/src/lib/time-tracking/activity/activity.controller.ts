import { Controller, UseGuards, HttpStatus, Get, Query, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { IGetActivitiesInput, ReportGroupFilterEnum, PermissionsEnum, IActivity } from '@gauzy/contracts';
import { PermissionGuard, TenantPermissionGuard } from './../../shared/guards';
import { Permissions } from './../../shared/decorators';
import { UseValidationPipe } from '../../shared/pipes';
import { ActivityService } from './activity.service';
import { ActivityMapService } from './activity.map.service';
import { BulkActivityInputDTO } from './dto/bulk-activities-input.dto';
import { ActivityQueryDTO } from './dto';

@ApiTags('Activity')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.TIME_TRACKER, PermissionsEnum.TIMESHEET_EDIT_TIME)
@Controller()
export class ActivityController {
	constructor(
		private readonly activityService: ActivityService,
		private readonly activityMapService: ActivityMapService
	) {}

	/**
	 * Retrieves a paginated list of activities based on the provided query parameters.
	 *
	 * @param options - The query parameters for fetching activities, including pagination options.
	 * @returns A promise resolving to a paginated list of activities.
	 */
	@ApiOperation({
		summary: 'Retrieve paginated activities',
		description: 'Fetches a paginated list of activities based on filters like date, employee, and project.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved activities'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the request parameters may contain errors'
	})
	@Get('/')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getActivities(@Query() options: ActivityQueryDTO): Promise<IActivity[]> {
		const defaultParams: Partial<IGetActivitiesInput> = { page: 0, limit: 30 };
		options = Object.assign({}, defaultParams, options);
		return await this.activityService.getActivities(options);
	}

	/**
	 * Retrieves daily activities based on the provided query parameters.
	 *
	 * @param options - The query parameters for fetching daily activities.
	 * @returns A promise resolving to a list of daily activities.
	 */
	@ApiOperation({
		summary: 'Retrieve daily activities',
		description: 'Fetches a list of daily activities filtered by parameters such as date, employee, and project.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved daily activities'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the request parameters may contain errors'
	})
	@Get('/daily')
	@UseValidationPipe({ transform: true, whitelist: true })
	async getDailyActivities(@Query() options: ActivityQueryDTO) {
		return await this.activityService.getDailyActivities(options);
	}

	/**
	 * Retrieves a report of daily activities based on the provided query parameters.
	 *
	 * @param options - The query parameters for fetching the daily activities report, including grouping options.
	 * @returns A promise resolving to a grouped report of daily activities.
	 */
	@ApiOperation({
		summary: 'Retrieve daily activities report',
		description: 'Fetches a report of daily activities grouped by parameters like date, employee, or project.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Successfully retrieved the daily activities report'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the request parameters may contain errors'
	})
	@Get('/report')
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

	/**
	 * Saves multiple activities in bulk.
	 *
	 * @param entities - The list of activities to be saved in bulk.
	 * @returns A promise resolving when the bulk save is complete.
	 */
	@ApiOperation({
		summary: 'Bulk save activities',
		description: 'Saves multiple activities in one request. Useful for bulk data insertion.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'The activities have been successfully saved'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, the request body may contain errors'
	})
	@Post('/bulk')
	@UseValidationPipe()
	async bulkSaveActivities(@Body() entities: BulkActivityInputDTO) {
		return await this.activityService.bulkSave(entities);
	}
}
