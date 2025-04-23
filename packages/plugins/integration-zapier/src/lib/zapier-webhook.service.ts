import { HttpService } from '@nestjs/axios';
import {
	Injectable,
	Logger,
	ForbiddenException,
	NotFoundException,
	InternalServerErrorException
} from '@nestjs/common';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { ZapierWebhookSubscription } from './zapier-webhook-subscription.entity';
import { TypeOrmZapierWebhookSubscriptionRepository } from './repository/type-orm-zapier-webhook-subscription.repository';
import { ITimerZapierWebhookData } from './zapier.types';

@Injectable()
export class ZapierWebhookService {
	private readonly logger = new Logger(ZapierWebhookService.name);

	constructor(
		private readonly zapierWebhookSubscriptionRepository: TypeOrmZapierWebhookSubscriptionRepository,
		private readonly _httpService: HttpService
	) {}

	/**
	 * Creates a new Zapier webhook subscription if it doesn't already exist.
	 *
	 * @param input - The subscription details including targetUrl, event, integrationId, tenantId, and organizationId.
	 * @returns The existing or newly created ZapierWebhookSubscription.
	 * @throws InternalServerErrorException if the operation fails.
	 */
	async createSubscription(input: {
		targetUrl: string;
		event: string;
		integrationId?: ID;
		tenantId?: ID;
		organizationId?: ID;
	}): Promise<ZapierWebhookSubscription> {
		try {
			const { targetUrl, event, integrationId, tenantId, organizationId } = input;

			// Check for an existing subscription to prevent duplicates
			const existingSubscription = await this.zapierWebhookSubscriptionRepository.findOne({
				where: {
					targetUrl,
					event,
					integrationId,
					tenantId,
					organizationId
				}
			});

			if (existingSubscription) {
				return existingSubscription;
			}

			// Create and save the new subscription
			const newSubscription = this.zapierWebhookSubscriptionRepository.create(input);
			return await this.zapierWebhookSubscriptionRepository.save(newSubscription);
		} catch (error) {
			this.logger.error('Failed to create webhook subscription', error);
			throw new InternalServerErrorException('Failed to create webhook subscription');
		}
	}

	/**
	 * Deletes a Zapier webhook subscription after verifying tenant ownership.
	 *
	 * @param id - The unique identifier of the subscription to delete.
	 * @param tenantId - The tenant ID to verify ownership of the subscription.
	 */
	async deleteSubscription(id: ID, tenantId: ID): Promise<void> {
		try {
			const subscription = await this.zapierWebhookSubscriptionRepository.findOne({
				where: { id }
			});

			if (!subscription) {
				this.logger.warn(`No webhook subscription found with id ${id}`);
				throw new NotFoundException(`No webhook subscription found with id ${id}`);
			}

			if (subscription.tenantId !== tenantId) {
				this.logger.warn(
					`Unauthorized deletion attempt: Subscription ID ${id} does not belong to tenant ${tenantId}`
				);
				throw new ForbiddenException('You do not have permission to delete this webhook subscription.');
			}

			const result = await this.zapierWebhookSubscriptionRepository.delete(id);

			if (result.affected === 0) {
				this.logger.warn(`Deletion failed: No subscription deleted for id ${id}`);
				throw new NotFoundException(`No webhook subscription found with id ${id}`);
			}

			this.logger.log(`Successfully deleted webhook subscription with id ${id}`);
		} catch (error) {
			this.logger.error(`Failed to delete webhook subscription with id ${id}`, error);
			throw new InternalServerErrorException('Failed to delete webhook subscription.');
		}
	}

	/**
	 * Broadcasts timer status change events to all registered webhook subscribers.
	 *
	 * Retrieves subscriptions for the `timer.status.changed` event matching the provided
	 * tenant and organization IDs, then concurrently posts the event payload to each
	 * subscriber’s callback URL. Individual delivery failures are logged but do not
	 * interrupt other notifications.
	 *
	 * @param timerData - The payload containing timer details, including `tenantId`, `organizationId`, and other relevant fields.
	 */
	async notifyTimerStatusChanged(timerData: ITimerZapierWebhookData): Promise<void> {
		const { tenantId, organizationId } = timerData;

		// 1) Validate that we have the required identifiers
		if (!tenantId || !organizationId) {
			this.logger.warn('Cannot notify webhook: missing tenantId or organizationId', { tenantId, organizationId });
			return;
		}

		// 2) Load all matching subscriptions
		const subscriptions = await this.zapierWebhookSubscriptionRepository.find({
			where: {
				event: 'timer.status.changed',
				tenantId,
				organizationId
			}
		});

		if (subscriptions.length === 0) {
			// Nothing to do if no subscribers
			return;
		}

		// 3) Send notifications in parallel
		await Promise.all(
			subscriptions.map((sub) =>
				firstValueFrom(
					this._httpService
						.post(sub.targetUrl, {
							event: 'timer.status.changed',
							data: timerData
						})
						.pipe(
							catchError((err) => {
								this.logger.error(`Failed to notify webhook ${sub.id} at ${sub.targetUrl}`, err);
								return of(null); // swallow error so other calls continue
							})
						)
				)
			)
		);
	}
}
