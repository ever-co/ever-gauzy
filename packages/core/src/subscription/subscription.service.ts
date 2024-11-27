import { BadRequestException, Injectable } from '@nestjs/common';
import { ISubscription, ISubscriptionCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from './../core/crud';
import { RequestContext } from '../core/context';
import { Subscription } from './subscription.entity';
import { MikroOrmSubscriptionRepository } from './repository/mikro-orm-subscription.repository';
import { TypeOrmSubscriptionRepository } from './repository/type-orm-subscription.repository';

@Injectable()
export class SubscriptionService extends TenantAwareCrudService<Subscription> {
	constructor(
		readonly typeOrmSubscriptionRepository: TypeOrmSubscriptionRepository,
		readonly mikroOrmSubscriptionRepository: MikroOrmSubscriptionRepository
	) {
		super(typeOrmSubscriptionRepository, mikroOrmSubscriptionRepository);
	}

	/**
	 * Creates a new subscription for the specified entity and user.
	 *
	 * @param {ISubscriptionCreateInput} input - The input object containing subscription details, including the entity type, entity ID, and optional tenant ID.
	 * @returns {Promise<ISubscription>} A promise resolving to the created subscription, or the existing subscription if it already exists.
	 * @throws {BadRequestException} Throws a BadRequestException if the subscription creation fails due to an error.
	 */
	async create(input: ISubscriptionCreateInput): Promise<ISubscription> {
		try {
			const userId = RequestContext.currentUserId();
			const tenantId = RequestContext.currentTenantId() || input.tenantId;

			const { entity, entityId } = input;

			// Check if the subscription already exists
			const existingSubscription = await this.findOneByOptions({ where: { userId, entity, entityId } });
			if (existingSubscription) {
				return existingSubscription;
			}

			// Create a new subscription if none exists
			const subscription = await super.create({ ...input, tenantId, userId });

			/**
			 * TODO : Optional subscription notification if needed
			 */

			return subscription;
		} catch (error) {
			console.log('Error creating subscription:', error);
			throw new BadRequestException('Failed to create subscription', error);
		}
	}
}
