import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { Logger } from '@nestjs/common';
import { DataSource, EntitySubscriberInterface, EventSubscriber } from 'typeorm';
import { PluginSubscription } from '../../domain/entities/plugin-subscription.entity';

@EventSubscriber()
export class PluginSubscriptionSubscriber implements EntitySubscriberInterface<PluginSubscription> {
	private readonly logger = new Logger(PluginSubscriptionSubscriber.name);

	constructor(readonly dataSource: DataSource) {
		dataSource.subscribers.push(this);
	}

	/**
	 * Indicates that this subscriber only listens to PluginSubscription events
	 */
	listenTo() {
		return PluginSubscription;
	}

	/**
	 * Called after entity is loaded from the database
	 * Computes dynamic properties and validates subscription state
	 */
	public async afterLoad(entity: PluginSubscription): Promise<void> {
		if (!entity || !entity.id) {
			return;
		}

		try {
			this.logger.debug(`Processing afterLoad for plugin subscription: ${entity.id}`);

			// Auto-update status if expired
			this.updateStatusIfExpired(entity);

			// Log subscription state for debugging
			this.logSubscriptionState(entity);
		} catch (error) {
			this.logger.error(`Error in afterLoad for plugin subscription ${entity.id}: ${error.message}`, error.stack);
		}
	}

	/**
	 * Updates subscription status to EXPIRED if end date has passed
	 * This ensures status is accurate when entity is loaded
	 */
	private updateStatusIfExpired(entity: PluginSubscription): void {
		if (
			entity.endDate &&
			entity.endDate <= new Date() &&
			entity.status !== PluginSubscriptionStatus.EXPIRED &&
			entity.status !== PluginSubscriptionStatus.CANCELLED
		) {
			this.logger.debug(`Subscription ${entity.id} has expired, updating status`);
			// Note: This updates the in-memory entity only
			// Actual persistence should be handled by a scheduled job
			entity.status = PluginSubscriptionStatus.EXPIRED;
		}
	}

	/**
	 * Logs subscription state information for monitoring and debugging
	 */
	private logSubscriptionState(entity: PluginSubscription): void {
		const state = {
			id: entity.id,
			status: entity.status,
			scope: entity.scope,
			subscriberId: entity.subscriberId,
			isActive: entity.isSubscriptionActive,
			isExpired: entity.isExpired,
			isInTrial: entity.isInTrial,
			isExpiringSoon: entity.isExpiringSoon,
			daysUntilExpiration: entity.daysUntilExpiration,
			nextBillingDate: entity.nextBillingDate,
			isBillingDue: entity.isBillingDue
		};
		this.logger.debug(`Subscription state for ${entity.id}: ${JSON.stringify(state)}`);
	}
}
