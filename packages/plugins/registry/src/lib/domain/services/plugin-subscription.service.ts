import { ID } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable } from '@nestjs/common';
import { PluginScope, PluginSubscriptionStatus } from '../../shared/models';
import { PluginSubscription } from '../entities';
import { MikroOrmPluginSubscriptionRepository, TypeOrmPluginSubscriptionRepository } from '../repositories';

@Injectable()
export class PluginSubscriptionService extends TenantAwareCrudService<PluginSubscription> {
	constructor(
		public readonly typeOrmPluginSubscriptionRepository: TypeOrmPluginSubscriptionRepository,
		public readonly mikroOrmPluginSubscriptionRepository: MikroOrmPluginSubscriptionRepository
	) {
		super(typeOrmPluginSubscriptionRepository, mikroOrmPluginSubscriptionRepository);
	}

	/**
	 * Create child subscriptions for users
	 * @param parentSubscriptionId - The ID of the parent subscription
	 * @param userIds - Array of user IDs to create subscriptions for
	 * @param tenantId - The tenant ID
	 * @param organizationId - The organization ID (optional)
	 * @returns Promise<PluginSubscription[]> - The created child subscriptions
	 */
	async createChildSubscriptions(
		parentSubscriptionId: ID,
		userIds: ID[],
		tenantId: ID,
		organizationId?: ID
	): Promise<PluginSubscription[]> {
		// Find the parent subscription
		const parentSubscription = await this.findOneByIdString(parentSubscriptionId);
		if (!parentSubscription) {
			throw new Error('Parent subscription not found');
		}

		const childSubscriptions: PluginSubscription[] = [];

		for (const userId of userIds) {
			// Check if child subscription already exists
			const existingChild = await this.findOneByWhereOptions({
				parentId: parentSubscriptionId,
				subscriberId: userId,
				tenantId,
				organizationId
			});

			if (!existingChild) {
				// Create child subscription
				const childSubscription = await this.create({
					pluginId: parentSubscription.pluginId,
					pluginTenantId: parentSubscription.pluginTenantId,
					planId: parentSubscription.planId,
					parentId: parentSubscriptionId,
					subscriberId: userId,
					tenantId,
					organizationId,
					status: parentSubscription.status,
					scope: PluginScope.USER, // Child subscriptions are always USER-scoped
					startDate: new Date(),
					endDate: parentSubscription.endDate,
					autoRenew: false, // Child subscriptions don't auto-renew
					metadata: {
						createdFrom: 'assignment',
						parentSubscriptionId: parentSubscriptionId,
						assignedAt: new Date().toISOString()
					}
				});

				childSubscriptions.push(childSubscription);
			}
		}

		return childSubscriptions;
	}

	/**
	 * Revoke child subscriptions for users
	 * @param parentSubscriptionId - The ID of the parent subscription
	 * @param userIds - Array of user IDs to revoke subscriptions for
	 * @returns Promise<PluginSubscription[]> - The revoked child subscriptions
	 */
	async revokeChildSubscriptions(parentSubscriptionId: ID, userIds: ID[]): Promise<PluginSubscription[]> {
		const revokedSubscriptions: PluginSubscription[] = [];

		for (const userId of userIds) {
			// Find child subscription
			const childSubscription = await this.findOneByWhereOptions({
				parentId: parentSubscriptionId,
				subscriberId: userId,
				status: PluginSubscriptionStatus.ACTIVE
			});

			if (childSubscription) {
				// Update status to cancelled/revoked
				const updated = await this.update(childSubscription.id, {
					status: PluginSubscriptionStatus.CANCELLED,
					cancelledAt: new Date(),
					cancellationReason: 'Access revoked by administrator'
				});

				if (updated) {
					// Fetch the updated subscription and manually update metadata
					const updatedSubscription = await this.findOneByIdString(childSubscription.id);
					if (updatedSubscription) {
						// Update metadata separately if needed
						updatedSubscription.metadata = {
							...updatedSubscription.metadata,
							revokedAt: new Date().toISOString(),
							revokedBy: 'administrator'
						};
						// Save the metadata changes
						await this.save(updatedSubscription);
						revokedSubscriptions.push(updatedSubscription);
					}
				}
			}
		}

		return revokedSubscriptions;
	}
}
