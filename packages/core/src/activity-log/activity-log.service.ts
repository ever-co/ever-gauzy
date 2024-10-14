import { BadRequestException, Injectable } from '@nestjs/common';
import { FindManyOptions, FindOptionsOrder, FindOptionsWhere } from 'typeorm';
import { IActivityLog, IActivityLogInput, IPagination } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { GetActivityLogsDTO, allowedOrderDirections, allowedOrderFields } from './dto/get-activity-logs.dto';
import { ActivityLog } from './activity-log.entity';
import { MikroOrmActivityLogRepository, TypeOrmActivityLogRepository } from './repository';

@Injectable()
export class ActivityLogService extends TenantAwareCrudService<ActivityLog> {
	constructor(
		readonly typeOrmActivityLogRepository: TypeOrmActivityLogRepository,
		readonly mikroOrmActivityLogRepository: MikroOrmActivityLogRepository
	) {
		super(typeOrmActivityLogRepository, mikroOrmActivityLogRepository);
	}

	/**
	 * Finds and retrieves activity logs based on the given filter criteria.
	 *
	 * @param {GetActivityLogsDTO} filter - Filter criteria to find activity logs, including entity, entityId, action, actorType, isActive, isArchived, orderBy, and order.
	 * @returns {Promise<IPagination<IActivityLog>>} - A promise that resolves to a paginated list of activity logs.
	 *
	 * Example usage:
	 * ```
	 * const logs = await findActivityLogs({
	 *     entity: 'User',
	 *     action: 'CREATE',
	 *     orderBy: 'updatedAt',
	 *     order: 'ASC'
	 * });
	 * ```
	 */
	public async findActivityLogs(filters: GetActivityLogsDTO): Promise<IPagination<IActivityLog>> {
		const {
			organizationId,
			entity,
			entityId,
			action,
			actorType,
			isActive = true,
			isArchived = false,
			orderBy = 'createdAt',
			order = 'DESC',
			relations = []
		} = filters;

		// Build the 'where' condition using concise syntax
		const where: FindOptionsWhere<ActivityLog> = {
			...(entity && { entity }),
			...(entityId && { entityId }),
			...(action && { action }),
			...(actorType !== undefined && actorType !== null && { actorType }), // Ensure 0 is not ignored
			organizationId,
			isActive,
			isArchived
		};

		// Fallback to default if invalid orderBy/order values are provided
		const orderField = allowedOrderFields.includes(orderBy) ? orderBy : 'createdAt';
		const orderDirection = allowedOrderDirections.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

		// Define order option
		const orderOption: FindOptionsOrder<ActivityLog> = { [orderField]: orderDirection };

		// Ensure that filters are properly defined
		const queryOptions: FindManyOptions<ActivityLog> = {
			where,
			...(relations && { relations }),
			take: filters.take ?? 100, // Default to 100 if not provided
			skip: filters.skip ? filters.take * (filters.skip - 1) : 0 // Calculate offset
		};

		// Apply sorting options (if provided)
		if (filters.order) {
			queryOptions.order = orderOption; // Order, in which entities should be ordered. Default to ASC if no order is provided.
		}

		console.log('queryOptions', queryOptions);
		// Retrieve activity logs using the base class method
		return await super.findAll(queryOptions);
	}

	/**
	 * Creates a new activity log entry with the provided input, while associating it with the current user and tenant.
	 *
	 * @param input - The data required to create an activity log entry.
	 * @returns The created activity log entry.
	 * @throws BadRequestException when the log creation fails.
	 */
	async logActivity(input: IActivityLogInput): Promise<IActivityLog> {
		try {
			const creatorId = RequestContext.currentUserId(); // Retrieve the current user's ID from the request context
			// Create the activity log entry using the provided input along with the tenantId and creatorId
			return await super.create({ ...input, creatorId });
		} catch (error) {
			console.log('Error while creating activity log:', error);
			throw new BadRequestException('Error while creating activity log', error);
		}
	}
}
