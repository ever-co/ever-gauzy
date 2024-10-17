import { BadRequestException, Injectable } from '@nestjs/common';
import { FindManyOptions, FindOptionsOrder, FindOptionsWhere } from 'typeorm';
import {
	ActionTypeEnum,
	ActorTypeEnum,
	BaseEntityEnum,
	IActivityLog,
	IActivityLogInput,
	ID,
	IPagination
} from '@gauzy/contracts';
import { isNotNullOrUndefined } from '@gauzy/common';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { GetActivityLogsDTO, allowedOrderDirections, allowedOrderFields } from './dto/get-activity-logs.dto';
import { ActivityLog } from './activity-log.entity';
import { MikroOrmActivityLogRepository, TypeOrmActivityLogRepository } from './repository';
import { EventBus } from '@nestjs/cqrs';
import { activityLogUpdatedFieldsAndValues, generateActivityLogDescription } from './activity-log.helper';
import { ActivityLogEvent } from './events';

@Injectable()
export class ActivityLogService extends TenantAwareCrudService<ActivityLog> {
	constructor(
		readonly typeOrmActivityLogRepository: TypeOrmActivityLogRepository,
		readonly mikroOrmActivityLogRepository: MikroOrmActivityLogRepository,
		private readonly _eventBus: EventBus
	) {
		super(typeOrmActivityLogRepository, mikroOrmActivityLogRepository);
	}

	/**
	 * Finds and retrieves activity logs based on the given filters criteria.
	 *
	 * @param {GetActivityLogsDTO} filters - Filter criteria to find activity logs, including entity, entityId, action, actorType, isActive, isArchived, orderBy, and order.
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

		// Fallback to default if invalid orderBy/order values are provided
		const orderField = allowedOrderFields.includes(orderBy) ? orderBy : 'createdAt';
		const orderDirection = allowedOrderDirections.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

		// Define order option
		const orderOption: FindOptionsOrder<ActivityLog> = { [orderField]: orderDirection };

		// Build the 'where' condition using concise syntax
		const where: FindOptionsWhere<ActivityLog> = {
			...(organizationId && { organizationId }),
			...(entity && { entity }),
			...(entityId && { entityId }),
			...(action && { action }),
			...(isNotNullOrUndefined(actorType) && { actorType }),
			isActive,
			isArchived
		};

		const take = filters.take ? filters.take : 100; // Default take value if not provided
		// Pagination: ensure `filters.skip` is a positive integer starting from 1
		const skip = filters.skip && Number.isInteger(filters.skip) && filters.skip > 0 ? filters.skip : 1;

		// Ensure that filters are properly defined
		const queryOptions: FindManyOptions<ActivityLog> = {
			where,
			...(relations && { relations }),
			take: take,
			skip: take * (skip - 1) // Calculate offset (skip) based on validated skip value
		};

		// Apply sorting options (if provided)
		queryOptions.order = orderOption;

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
	async create(input: IActivityLogInput): Promise<IActivityLog> {
		try {
			const creatorId = RequestContext.currentUserId(); // Retrieve the current user's ID from the request context
			// Create the activity log entry using the provided input along with the tenantId and creatorId
			return await super.create({ ...input, creatorId });
		} catch (error) {
			console.log('Error while creating activity log:', error);
			throw new BadRequestException('Error while creating activity log', error);
		}
	}

	/**
	 * @description Create or Update Activity Log
	 * @template T
	 * @param {BaseEntityEnum} entityType - Entity type for whom creating activity log (E.g : Task, OrganizationProject, etc.)
	 * @param {string} entityName - Name or Title of the entity
	 * @param {ActorTypeEnum} actor - The actor type performing the action (User or System)
	 * @param {ID} organizationId
	 * @param {ID} tenantId
	 * @param {ActionTypeEnum} actionType - Action performed (Created or Updated)
	 * @param {T} data - Entity data (for Created action) or Updated entity data (for Updated action)
	 * @param {Partial<T>} [originalValues] - Entity data before update (optional for Update action)
	 * @param {Partial<T>} [newValues] - Entity updated data per field (optional for Update action)
	 */
	logActivity<T>(
		entityType: BaseEntityEnum,
		entityName: string,
		actor: ActorTypeEnum,
		organizationId: ID,
		tenantId: ID,
		actionType: ActionTypeEnum,
		data: T,
		originalValues?: Partial<T>,
		newValues?: Partial<T>
	) {
		// Generate the activity log description based on action type
		const description = generateActivityLogDescription(actionType, entityType, entityName);

		// Initialize log event payload
		const logPayload: IActivityLog = {
			entity: entityType,
			entityId: data['id'],
			action: actionType,
			actorType: actor,
			description,
			data,
			organizationId,
			tenantId
		};

		// If it's an update action, add updated fields and values
		if (actionType === ActionTypeEnum.Updated && originalValues && newValues) {
			const { updatedFields, previousValues, updatedValues } = activityLogUpdatedFieldsAndValues(
				originalValues,
				newValues
			);

			// Add updated fields and values to the log
			Object.assign(logPayload, { updatedFields, previousValues, updatedValues });
		}

		// Emit the event to log the activity
		return this._eventBus.publish(new ActivityLogEvent(logPayload));
	}
}
