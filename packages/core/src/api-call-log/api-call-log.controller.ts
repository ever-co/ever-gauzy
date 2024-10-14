import { Controller, Get, Delete, Query, UseGuards, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DeleteResult } from 'typeorm';
import { IApiCallLog, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { UseValidationPipe } from '../shared/pipes';
import { ApiCallLogService } from './api-call-log.service';
import { ApiCallLogFilterDTO } from './dto/api-call-log-filter.dto';
import { DeleteApiCallLogDTO } from './dto/api-call-log-delete.dto';
import { ApiCallLog } from './api-call-log.entity';

@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.API_CALL_LOG_READ)
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
	@UseValidationPipe()
	async findAll(@Query() filters: ApiCallLogFilterDTO): Promise<IPagination<IApiCallLog>> {
		return this._apiCallLogService.findAllLogs(filters);
	}

	/**
	 * Deletes an API call log by its ID.
	 *
	 * @param id The ID of the API call log to be deleted.
	 * @returns A promise that resolves to an object indicating the delete status.
	 */
	@ApiOperation({ summary: 'Delete an API call log by ID' })
	@ApiResponse({
		status: 200,
		description: 'API call log deleted successfully.'
	})
	@ApiResponse({
		status: 404,
		description: 'API call log not found.'
	})
	@ApiResponse({
		status: 500,
		description: 'Internal server error.'
	})
	@Delete('/:id')
	@UseValidationPipe()
	async deleteById(@Param('id') id: ID, @Query() filters: DeleteApiCallLogDTO): Promise<DeleteResult | ApiCallLog> {
		// If the forceDelete flag is set, perform a soft delete
		if (filters.forceDelete) {
			return this._apiCallLogService.softDelete(id, { where: { ...filters } });
		}
		// Otherwise, perform a hard delete
		return this._apiCallLogService.delete(id, { where: { ...filters } });
	}
}
