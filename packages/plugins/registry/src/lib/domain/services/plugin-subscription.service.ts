import { ID, PluginScope, PluginSubscriptionStatus } from '@gauzy/contracts';
import { TenantAwareCrudService } from '@gauzy/core';
import { Injectable, Logger } from '@nestjs/common';
import { In } from 'typeorm';
import { IPluginSubscription } from '../../shared';
import { PluginSubscription } from '../entities';
import { MikroOrmPluginSubscriptionRepository, TypeOrmPluginSubscriptionRepository } from '../repositories';

@Injectable()
export class PluginSubscriptionService extends TenantAwareCrudService<PluginSubscription> {
	private readonly logger = new Logger(PluginSubscriptionService.name);

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
		const { success, record: parent } = await this.findOneOrFailByIdString(parentSubscriptionId, {
			relations: ['plugin', 'pluginTenant']
		});

		if (!success || !parent) {
			throw new Error('Parent subscription not found');
		}

		if (!parent.pluginId) {
			throw new Error('Parent subscription pluginId is missing');
		}

		if (!parent.pluginTenantId) {
			throw new Error('Parent subscription pluginTenantId is missing');
		}

		// Find existing child subscriptions in a single query
		const existingChildren = await this.find({
			where: {
				parentId: parentSubscriptionId,
				subscriberId: In(userIds),
				tenantId
			},
			select: ['subscriberId']
		});

		const existingUserIds = new Set(existingChildren.map((child) => child.subscriberId));
		const newUserIds = userIds.filter((userId) => !existingUserIds.has(userId));

		if (newUserIds.length === 0) {
			return [];
		}

		// Create child subscriptions in parallel (create() already persists)
		const createdChildren = await Promise.all(
			newUserIds.map((userId) =>
				this.create({
					pluginId: parent.pluginId,
					pluginTenantId: parent.pluginTenantId,
					planId: parent.planId,
					parentId: parentSubscriptionId,
					subscriberId: userId,
					tenantId,
					organizationId,
					status: parent.status,
					scope: PluginScope.USER,
					startDate: new Date(),
					endDate: parent.endDate,
					autoRenew: false,
					metadata: {
						createdFrom: 'assignment',
						parentSubscriptionId,
						assignedAt: new Date().toISOString()
					}
				})
			)
		);

		this.logger.log(`Created ${createdChildren.length} child subscriptions for parent ${parentSubscriptionId}`);

		return createdChildren;
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
				status: In([PluginSubscriptionStatus.ACTIVE, PluginSubscriptionStatus.PENDING])
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

	public upsert(entity: IPluginSubscription): Promise<IPluginSubscription> {
		return this.upsert(entity);
	}
}
