import { Injectable } from '@nestjs/common';
import { Between, FindManyOptions } from 'typeorm';
import * as moment from 'moment';
import { IApiCallLog, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { ApiCallLog } from './api-call-log.entity';
import { MikroOrmApiCallLogRepository } from './repository/mikro-orm-api-call-log.repository';
import { TypeOrmApiCallLogRepository } from './repository/type-orm-api-call-log.repository';
import { ApiCallLogFilterDTO } from './dto/api-call-log-filter.dto';

@Injectable()
export class ApiCallLogService extends TenantAwareCrudService<ApiCallLog> {
	constructor(
		readonly typeOrmApiCallLogRepository: TypeOrmApiCallLogRepository,
		readonly mikroOrmApiCallLogRepository: MikroOrmApiCallLogRepository
	) {
		super(typeOrmApiCallLogRepository, mikroOrmApiCallLogRepository);
	}

	/**
	 * Retrieves a paginated list of API call logs with optional filters applied.
	 *
	 * @param filters Object containing filtering options such as `correlationId`, `url`, `method`, etc.
	 * @returns A promise that resolves to a paginated list of `IApiCallLog` objects.
	 */
	async findAllLogs(filters: ApiCallLogFilterDTO): Promise<IPagination<IApiCallLog>> {
		// Ensure that filters are properly defined
		const queryOptions: FindManyOptions<ApiCallLog> = {
			where: {},
			...filters
		};

		// Check if `filters.where` is an array or an object, then apply individual filters
		if (!Array.isArray(filters)) {
			if (filters.correlationId) {
				queryOptions.where['correlationId'] = filters.correlationId;
			}
			if (filters.statusCode) {
				queryOptions.where['statusCode'] = filters.statusCode;
			}
			if (filters.ipAddress) {
				queryOptions.where['ipAddress'] = filters.ipAddress;
			}
			if (filters.userId) {
				queryOptions.where['userId'] = filters.userId;
			}

			// Apply date range filters for requestTime
			if (filters.startRequestTime || filters.endRequestTime) {
				// The start date for filtering, defaults to the start of today.
				const startRequestTime = filters.startRequestTime
					? moment(filters.startRequestTime).toDate()
					: moment().startOf('day').toDate();

				// The end date for filtering, defaults to the end of today.
				const endRequestTime = filters.endRequestTime
					? moment(filters.endRequestTime).toDate()
					: moment().endOf('day').toDate();

				// Retrieves a date range filter using the `startRequestTime` and `endRequestTime` values.
				queryOptions.where['requestTime'] = Between(
					startRequestTime, // Default to start of today if no start date is provided
					endRequestTime // Default to end of today if no end date is provided
				);
			}
		}

		// Apply pagination and sorting options (if provided)
		if (filters.take) {
			queryOptions.take = filters.take;
		}
		if (filters.skip) {
			queryOptions.skip = filters.skip;
		}
		if (filters.order) {
			queryOptions.order = filters.order;
		}

		// Perform the query with filters, sorting, and pagination applied
		return await super.findAll(queryOptions);
	}
}
