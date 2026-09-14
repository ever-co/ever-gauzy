import { HttpService } from '@nestjs/axios';
import {
	Injectable,
	Logger,
	BadRequestException,
	ForbiddenException,
	NotFoundException,
	InternalServerErrorException
} from '@nestjs/common';
import { catchError, firstValueFrom, of } from 'rxjs';
import { ID } from '@gauzy/contracts';
import { ZapierWebhookSubscription } from './zapier-webhook-subscription.entity';
import { TypeOrmZapierWebhookSubscriptionRepository } from './repository/type-orm-zapier-webhook-subscription.repository';
import { ITimerZapierWebhookData } from './zapier.types';
import { assertSafeZapierWebhookUrl, createSsrfSafeHttpsAgent } from './webhook-url.validator';

/** Delivery timeout for a single webhook POST, in milliseconds. */
const WEBHOOK_DELIVERY_TIMEOUT_MS = 10000;

/**
 * How long a successfully-delivered webhook's dedup key is remembered, to suppress an exact
 * redelivery of the same logical event (a duplicate `eventBus.publish()`, a CQRS-level retry) —
 * found via the TASK 4 idempotency investigation (see
 * `packages/core/src/lib/core/testing/idempotency/README.md`). In-process only: this does not
 * survive a restart and is not shared across horizontally-scaled instances, so it protects against
 * the redelivery scenario that's actually reachable today (an in-process CQRS event), not a
 * distributed queue's at-least-once delivery — see `ZapierTimerStartedHandler`'s own class comment.
 * A generous window relative to how quickly an in-process redelivery would actually happen.
 */
const WEBHOOK_DELIVERY_DEDUP_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class ZapierWebhookService {
	private readonly logger = new Logger(ZapierWebhookService.name);

	/**
	 * Shared agent that re-checks the resolved IP of every outbound webhook connection.
	 * Created once because each instance keeps its own connection pool.
	 */
	private readonly ssrfSafeHttpsAgent = createSsrfSafeHttpsAgent();

	/** Dedup key -> the time it expires from this cache. See `WEBHOOK_DELIVERY_DEDUP_WINDOW_MS`. */
	private readonly recentlyDelivered = new Map<string, number>();

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

			// Re-assert the egress guard here rather than trusting the controller: this method is a
			// public service API, and a caller that reaches it by another route must not be able to
			// store an unsafe target (GHSA-6gg6-vv4f-2x74).
			assertSafeZapierWebhookUrl(targetUrl);

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
			// A rejected target URL is caller error, not server error — keep the 400 (and its reason)
			// instead of flattening it into a 500.
			if (error instanceof BadRequestException) {
				throw error;
			}
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
			subscriptions.map(async (sub) => {
				// Re-validate at delivery time: rows stored before the egress guard existed have never
				// been checked, and a literal-host check alone cannot catch a public hostname that
				// resolves to an internal IP (GHSA-6gg6-vv4f-2x74).
				try {
					assertSafeZapierWebhookUrl(sub.targetUrl);
				} catch (error) {
					this.logger.warn(
						`Skipping Zapier webhook ${sub.id} — unsafe target URL: ${
							error instanceof Error ? error.message : error
						}`
					);
					return null;
				}

				// Idempotency guard (TASK 4 finding): a redelivered/duplicated event for the same
				// (subscriber, action, source timeLog) must not resend a webhook that already went out
				// — the receiving Zapier/Make.com zap has no dedup of its own on this payload.
				const deliveryKey = this.deliveryDedupKey(sub.id, timerData);
				if (this.hasRecentlyDelivered(deliveryKey)) {
					this.logger.debug(`Skipping duplicate webhook delivery ${deliveryKey} — already sent recently.`);
					return null;
				}

				const result = await firstValueFrom(
					this._httpService
						.post(
							sub.targetUrl,
							{
								event: 'timer.status.changed',
								data: timerData
							},
							{
								timeout: WEBHOOK_DELIVERY_TIMEOUT_MS,
								headers: { 'Content-Type': 'application/json' },
								// A 30x to an internal host would otherwise be followed by the default agent,
								// stepping around both the URL check and the resolver guard.
								maxRedirects: 0,
								httpsAgent: this.ssrfSafeHttpsAgent
							}
						)
						.pipe(
							catchError((err) => {
								this.logger.error(`Failed to notify webhook ${sub.id} at ${sub.targetUrl}`, err);
								return of(null); // swallow error so other calls continue
							})
						)
				);

				// Only remember a CONFIRMED delivery — `result` is `null` for both an unsafe-URL skip
				// (returned above) and a caught delivery failure (from `catchError` just above), and a
				// failed attempt must still be free to retry, not get suppressed as "already delivered."
				if (result !== null) {
					this.markDelivered(deliveryKey);
				}
				return result;
			})
		);
	}

	/** Identifies one logical webhook delivery: this subscriber, this action, this source timeLog. */
	private deliveryDedupKey(subscriptionId: ID, timerData: ITimerZapierWebhookData): string {
		return [subscriptionId, timerData.action, timerData.data?.id ?? ''].join(':');
	}

	private hasRecentlyDelivered(key: string): boolean {
		this.pruneExpiredDeliveries();
		return this.recentlyDelivered.has(key);
	}

	private markDelivered(key: string): void {
		this.recentlyDelivered.set(key, Date.now() + WEBHOOK_DELIVERY_DEDUP_WINDOW_MS);
	}

	private pruneExpiredDeliveries(): void {
		const now = Date.now();
		for (const [key, expiresAt] of this.recentlyDelivered) {
			if (expiresAt <= now) {
				this.recentlyDelivered.delete(key);
			}
		}
	}
}
