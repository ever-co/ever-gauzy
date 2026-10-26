import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { FindOptionsWhere, In } from 'typeorm';
import { PluginSubscriptionService } from '../../../../domain';
import { IPluginSubscription } from '../../../../shared';
import { GetActivePluginSubscriptionQuery } from '../get-active-plugin-subscription.query';

@QueryHandler(GetActivePluginSubscriptionQuery)
export class GetActivePluginSubscriptionQueryHandler implements IQueryHandler<GetActivePluginSubscriptionQuery> {
	/**
	 * Active subscription statuses that qualify as "active"
	 */
	private readonly ACTIVE_STATUSES = [
		PluginSubscriptionStatus.ACTIVE,
		PluginSubscriptionStatus.TRIAL,
		PluginSubscriptionStatus.PENDING
	];

	constructor(private readonly pluginSubscriptionService: PluginSubscriptionService) {}

	/**
	 * Executes the query to retrieve an active plugin subscription
	 * @param query - Query containing plugin, tenant, organization, and subscriber information
	 * @returns The active subscription or null if not found/expired
	 */
	async execute(query: GetActivePluginSubscriptionQuery): Promise<IPluginSubscription | null> {
		const { pluginId, tenantId, organizationId, subscriberId } = query;

		const whereConditions = this.buildWhereConditions(pluginId, tenantId, organizationId, subscriberId);
		const subscription = await this.findSubscription(whereConditions);

		return this.validateSubscription(subscription);
	}

	/**
	 * Builds the where conditions for the subscription query
	 */
	private buildWhereConditions(
		pluginId: string,
		tenantId: string,
		organizationId?: string,
		subscriberId?: string
	): FindOptionsWhere<IPluginSubscription> {
		const whereConditions: FindOptionsWhere<IPluginSubscription> = {
			pluginId,
			tenantId,
			status: In(this.ACTIVE_STATUSES)
		};

		if (organizationId) {
			whereConditions.organizationId = organizationId;
		}

		if (subscriberId) {
			whereConditions.subscriberId = subscriberId;
		}

		return whereConditions;
	}

	/**
	 * Fetches the most recent subscription matching the criteria, or `null` when there is none.
	 *
	 * Having no subscription is an answer, not an error: the marketplace asks `GET /plugins/:pluginId/subscriptions/me`
	 * for every plugin card it shows, and the desktop apps' error interceptor retries and toasts every failed request,
	 * so a `404` here put one error toast on the screen per plugin the user does not subscribe to.
	 */
	private async findSubscription(
		whereConditions: FindOptionsWhere<IPluginSubscription>
	): Promise<IPluginSubscription | null> {
		const { success, record } = await this.pluginSubscriptionService.findOneOrFailByOptions({
			where: whereConditions,
			order: { createdAt: 'DESC' },
			relations: ['plugin', 'plan', 'subscriber', 'parent']
		});

		return success ? record : null;
	}

	/**
	 * Validates that the subscription exists and is not expired
	 */
	private validateSubscription(subscription: IPluginSubscription | null): IPluginSubscription | null {
		if (!subscription || subscription.isExpired) {
			return null;
		}

		return subscription;
	}
}
