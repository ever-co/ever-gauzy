import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { IApiCallLog, IPagination } from '@gauzy/contracts';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLogFilterDTO } from './dto/api-call-log-filter.dto';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions()
@Controller('/api-call-log')
export class ApiCallLogController {
	constructor(private readonly _apiCallLogService: ApiCallLogService) {}

	/**
	 * Retrieves a paginated and filtered list of all API call logs from the system.
	 *
	 * @param filters DTO containing filtering options like `organizationId`, `correlationId`, `url`, etc.
	 * @returns A promise that resolves to a paginated list of `IApiCallLog` objects.
	 */
	@ApiOperation({ summary: 'Get all API call logs with mandatory organizationId and optional filters' })
	@ApiResponse({
		status: 200,
		description: 'Returns a list of all API call logs with filters applied.'
	})
	@ApiResponse({ status: 500, description: 'Internal server error.' })
	@Get('/')
	async findAll(@Query() filters: ApiCallLogFilterDTO): Promise<IPagination<IApiCallLog>> {
		return this._apiCallLogService.findAllLogs(filters);
	}
}
