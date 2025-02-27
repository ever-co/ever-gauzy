import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeleteResult } from 'typeorm';
import {
	ID,
	IEntitySubscription,
	IEntitySubscriptionCreateInput,
	IEntitySubscriptionFindInput
} from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { EntitySubscription } from './entity-subscription.entity';
import { MikroOrmEntitySubscriptionRepository } from './repository/mikro-orm-entity-subscription.repository';
import { TypeOrmEntitySubscriptionRepository } from './repository/type-orm-entity-subscription.repository';

@Injectable()
export class EntitySubscriptionService extends TenantAwareCrudService<EntitySubscription> {
	constructor(
		readonly typeOrmEntitySubscriptionRepository: TypeOrmEntitySubscriptionRepository,
		readonly mikroOrmEntitySubscriptionRepository: MikroOrmEntitySubscriptionRepository
	) {
		super(typeOrmEntitySubscriptionRepository, mikroOrmEntitySubscriptionRepository);
	}

	/**
	 * Creates a new subscription for the specified entity and user.
	 *
	 * @param {IEntitySubscriptionCreateInput} input - The input object containing subscription details, including the entity type, entity ID, and optional tenant ID.
	 * @returns {Promise<IEntitySubscription>} A promise resolving to the created subscription, or the existing subscription if it already exists.
	 * @throws {BadRequestException} Throws a BadRequestException if the subscription creation fails due to an error.
	 */
	async create(input: IEntitySubscriptionCreateInput): Promise<IEntitySubscription> {
		try {
			// Extract the tenant ID from the request context
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// Extract the user from the request context
			const user = RequestContext.currentUser();
			// Extract the employee ID from the user
			const employeeId = user.employeeId;
			// Extract the entity ID and type from the input
			const { entity, entityId, organizationId } = input;

			// Check if the subscription already exists
			try {
				const entitySubscription = await this.findOneByOptions({
					where: { employeeId, entity, entityId, organizationId, tenantId }
				});
				if (entitySubscription) {
					return entitySubscription;
				}
			} catch (e) {
				// If NotFoundException, continue with subscription creation
				if (!(e instanceof NotFoundException)) {
					throw e;
				}
			}

			// Create a new subscription if none exists
			const subscription = await super.create({ ...input, tenantId, employeeId });

			/**
			 * TODO : Optional subscription notification if needed
			 */
			return subscription;
		} catch (error) {
			console.log('Error creating subscription:', error);
			throw new BadRequestException('Failed to create subscription', error);
		}
	}

	/**
	 * Unsubscribes a user from a specific entity by deleting the corresponding subscription.
	 *
	 * @param {ID} id - The unique identifier of the subscription to delete.
	 * @param {IEntitySubscriptionFindInput} options - Additional options to refine the deletion query.
	 *   - `entity`: The type of entity the subscription is associated with (e.g., "project").
	 *   - `entityId`: The unique identifier of the associated entity.
	 * @returns {Promise<DeleteResult>} A promise that resolves to the result of the delete operation.
	 *
	 * @throws {BadRequestException} Throws an exception if an error occurs during the unsubscribe process.
	 */
	async unsubscribe(id: ID, input?: IEntitySubscriptionFindInput): Promise<DeleteResult> {
		try {
			// Extract the tenant ID from the request context
			const tenantId = RequestContext.currentTenantId() ?? input.tenantId;
			// Extract the user from the request context
			const user = RequestContext.currentUser();
			// Extract the employee ID from the user
			const employeeId = user.employeeId;
			// Extract the entity ID and type from the input
			const { entity, entityId, organizationId } = input || {};
			// Delete the subscription
			return await super.delete(id, {
				where: {
					entity,
					entityId,
					organizationId,
					tenantId,
					employeeId
				}
			});
		} catch (error) {
			console.log(`Error unsubscribing employee from entity: ${error}`);
			throw new BadRequestException('Failed to unsubscribing employee from entity', error);
		}
	}
}
