import { Injectable } from '@nestjs/common';
import { Between, FindManyOptions } from 'typeorm';
import moment from 'moment';
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
			take: filters.take ?? 100, // Default to 100 if not provided
			skip: filters.skip ? filters.take * (filters.skip - 1) : 0 // Calculate offset
		};

		// Apply sorting options (if provided)
		if (filters.order) {
			queryOptions.order = filters.order; // Order, in which entities should be ordered. Default to ASC if no order is provided.
		}

		// Check if `filters.where` is an array or an object, then apply individual filters
		if (!Array.isArray(filters)) {
			if (filters.organizationId) {
				queryOptions.where['organizationId'] = filters.organizationId;
			}
			if (filters.correlationId) {
				queryOptions.where['correlationId'] = filters.correlationId;
			}
			if (filters.statusCode) {
				queryOptions.where['statusCode'] = filters.statusCode;
			}
			if (filters.ipAddress) {
				queryOptions.where['ipAddress'] = filters.ipAddress;
			}
			if (filters.method) {
				queryOptions.where['method'] = filters.method;
			}
			if (filters.userId) {
				queryOptions.where['userId'] = filters.userId;
			}
			// Apply date range filters for requestTime
			if (filters.startRequestTime || filters.endRequestTime) {
				// The start date for filtering, defaults to the start of today.
				const start = filters.startRequestTime
					? moment(filters.startRequestTime).toDate()
					: moment().startOf('day').toDate();

				// The end date for filtering, defaults to the end of today.
				const end = filters.endRequestTime
					? moment(filters.endRequestTime).toDate()
					: moment().endOf('day').toDate(); // Default to end of today if no end date is provided

				// Retrieves a date range filter using the `start` and `end` values.
				queryOptions.where['requestTime'] = Between(start, end);
			}
		}

		// Perform the query with filters, sorting, and pagination applied
		return await super.findAll(queryOptions);
	}
}
