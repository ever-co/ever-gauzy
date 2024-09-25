import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IActivityLog, IPagination } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { GetActivityLogsDTO } from './dto/get-activity-logs.dto';
import { ActivityLogService } from './activity-log.service';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('/activity-log')
export class ActivityLogController {
    constructor(readonly _activityLogService: ActivityLogService) {}

	/**
	 * Retrieves activity logs based on query parameters.
	 * Supports filtering, pagination, sorting, and ordering.
	 *
	 * @param query Query parameters for filtering, pagination, and ordering.
	 * @returns A list of activity logs.
	 */
	@Get('/')
	@UseValidationPipe()
	async getActivityLogs(
		@Query() query: GetActivityLogsDTO
	): Promise<IPagination<IActivityLog>> {
		return await this._activityLogService.findActivityLogs(query);
	}
}
