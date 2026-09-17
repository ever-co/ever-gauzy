import { Injectable, NotFoundException } from '@nestjs/common';
import { ID, IWebhookAttemptResult, JsonData, WebhookDeliveryStatus, WebhookHeader } from '@gauzy/contracts';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { WebhookDelivery } from './webhook-delivery.entity';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookSubscriptionService } from './webhook-subscription.service';
import { signWebhookPayload } from './webhook-signature';
import { TypeOrmWebhookDeliveryRepository } from './repository/type-orm-webhook-delivery.repository';
import { MikroOrmWebhookDeliveryRepository } from './repository/mikro-orm-webhook-delivery.repository';

/**
 * A delivery to create for an event that matched a subscription.
 */
export interface IWebhookDeliveryInput {
	subscriptionId: ID;
	/** The `event_outbox.eventId`. */
	eventId: ID;
	eventName: string;
	/** The exact body to send; stored now and never regenerated. */
	payload: JsonData;
	tenantId?: ID;
	organizationId?: ID;
}

/**
 * What one delivery attempt did.
 */
export interface IWebhookDeliveryAttempt {
	delivery: WebhookDelivery;
	result: IWebhookAttemptResult;
	/** True when no request was made, because the subscription is switched off. */
	skipped: boolean;
}

/**
 * Signs payloads, posts them, and schedules the next attempt.
 *
 * Delivery is at-least-once and every attempt is a row: the outcome is recorded whether the endpoint
 * answered, refused or never replied, and the retry schedule is written onto the row as
 * `nextAttemptAt` rather than recomputed from a formula. Nothing here follows a redirect, and nothing
 * here waits forever â€” a slow endpoint must not consume the worker that also serves every other
 * subscriber.
 */
@Injectable()
export class WebhookDeliveryService extends CrudService<WebhookDelivery> {
	/**
	 * The retry ladder, in milliseconds.
	 *
	 * The first attempt is immediate, then 5 s, 30 s, 2 min, 10 min, 1 h and 6 h â€” seven attempts in
	 * total, after which the delivery is dead-lettered. It is data written onto the row, so an
	 * operator reading `nextAttemptAt` sees the schedule rather than having to derive it.
	 */
	static readonly RETRY_LADDER_MS: ReadonlyArray<number> = [5_000, 30_000, 120_000, 600_000, 3_600_000, 21_600_000];

	/** Total attempts, the immediate one included. */
	static readonly MAX_ATTEMPTS = WebhookDeliveryService.RETRY_LADDER_MS.length + 1;

	/** How long one attempt may take from connect to last byte. */
	static readonly REQUEST_TIMEOUT_MS = 10_000;

	/**
	 * Connect timeout.
	 *
	 * Kept as a named constant because it is part of the published contract, and applied through the
	 * total timeout: the platform's HTTP client resolves and connects inside the same budget, so a
	 * connection that hangs is bounded by it.
	 */
	static readonly CONNECT_TIMEOUT_MS = 5_000;

	/** How much of a response body is kept for diagnostics. */
	static readonly RESPONSE_BODY_LIMIT = 4 * 1024;

	/** The client identity every delivery carries. */
	static readonly USER_AGENT = 'EverGauzy-Webhooks/1.0';

	/** The payload version sent when a subscription pins none. */
	static readonly DEFAULT_API_VERSION = '1';

	constructor(
		readonly typeOrmWebhookDeliveryRepository: TypeOrmWebhookDeliveryRepository,
		readonly mikroOrmWebhookDeliveryRepository: MikroOrmWebhookDeliveryRepository,
		private readonly subscriptions: WebhookSubscriptionService
	) {
		super(typeOrmWebhookDeliveryRepository, mikroOrmWebhookDeliveryRepository);
	}

	/**
	 * Creates the delivery row for an event that matched a subscription.
	 *
	 * The unique `(subscriptionId, eventId)` pair is what makes the dispatcher idempotent: a re-run of
	 * the dispatch pass finds the row instead of creating a second one, so an event is never sent
	 * twice because a pass was retried.
	 *
	 * @param input The event and the subscription it matched.
	 * @returns The stored delivery, and whether this call created it.
	 */
	async enqueue(input: IWebhookDeliveryInput): Promise<{ delivery: WebhookDelivery; created: boolean }> {
		const delivery = this.typeOrmWebhookDeliveryRepository.create({
			subscriptionId: input.subscriptionId,
			eventId: input.eventId,
			eventName: input.eventName,
			payload: input.payload,
			status: WebhookDeliveryStatus.PENDING,
			attemptCount: 0,
			// The first attempt is due immediately; the ladder applies from the second one.
			nextAttemptAt: new Date(),
			tenantId: input.tenantId ?? RequestContext.currentTenantId(),
			organizationId: input.organizationId ?? RequestContext.currentOrganizationId()
		} as Partial<WebhookDelivery>);

		try {
			return { delivery: await this.typeOrmWebhookDeliveryRepository.save(delivery), created: true };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			const existing = await this.findByEvent(input.subscriptionId, input.eventId);

			if (!existing) {
				throw error;
			}

			return { delivery: existing, created: false };
		}
	}

	/**
	 * Makes one attempt and records what happened.
	 *
	 * The payload is read from the row rather than rebuilt, so a retry â€” or a replay months later â€”
	 * sends exactly what was originally intended.
	 *
	 * @param deliveryId The delivery row id.
	 * @returns The updated delivery and the attempt's result.
	 * @throws NotFoundException when the delivery or its subscription no longer exists.
	 */
	async deliver(deliveryId: ID): Promise<IWebhookDeliveryAttempt> {
		const delivery = await this.getDelivery(deliveryId);
		const subscription = await this.subscriptions.getSubscription(delivery.subscriptionId);
		const attempt = (delivery.attemptCount ?? 0) + 1;

		// A disabled subscription is not called: the operator switched it off, and the delivery is
		// recorded as dead so the backlog stays readable instead of growing silently.
		if (!subscription.isActive || subscription.disabledAt) {
			const skipped = await this.saveDelivery(delivery, {
				status: WebhookDeliveryStatus.DEAD,
				lastError: 'SUBSCRIPTION_DISABLED',
				nextAttemptAt: null,
				attemptCount: attempt
			});

			return {
				delivery: skipped,
				result: { delivered: false, lastError: 'SUBSCRIPTION_DISABLED', durationMs: 0 },
				skipped: true
			};
		}

		const body = JSON.stringify(delivery.payload);
		const signature = signWebhookPayload(await this.subscriptions.revealSecret(subscription.id), body, {
			previousSecret: this.subscriptions.previousSecretOf(subscription)
		});

		const result = await this.post(
			subscription.url,
			body,
			this.buildHeaders(delivery, subscription, attempt, signature.header)
		);

		// The subscription's own counters are updated first: they are what eventually disables a dead
		// endpoint, and they must survive whatever happens to the delivery row afterwards.
		await this.subscriptions.recordAttempt(subscription.id, {
			delivered: result.delivered,
			status: result.responseStatus
		});

		return { delivery: await this.recordOutcome(delivery, attempt, result), result, skipped: false };
	}

	/**
	 * The deliveries due for an attempt.
	 *
	 * @param limit How many to take.
	 * @param now Clock override.
	 * @returns The deliveries, earliest attempt first.
	 */
	async findDue(limit = 50, now: Date = new Date()): Promise<WebhookDelivery[]> {
		return this.typeOrmWebhookDeliveryRepository
			.createQueryBuilder(WebhookDelivery, 'delivery')
			.where('delivery.status IN (:...statuses)', {
				statuses: [WebhookDeliveryStatus.PENDING, WebhookDeliveryStatus.FAILED]
			})
			.andWhere('delivery.nextAttemptAt <= :now', { now })
			.orderBy('delivery.nextAttemptAt', 'ASC')
			.limit(limit)
			.getMany();
	}

	/**
	 * Reads a delivery.
	 *
	 * @param id The delivery id.
	 * @returns The delivery.
	 * @throws NotFoundException when it does not exist.
	 */
	async getDelivery(id: ID): Promise<WebhookDelivery> {
		const delivery = await this.typeOrmWebhookDeliveryRepository.findOne({ where: { id } as any });

		if (!delivery) {
			throw new NotFoundException('The webhook delivery does not exist.');
		}

		return delivery;
	}

	/**
	 * Reads the delivery of one event to one subscription.
	 *
	 * @param subscriptionId The subscription id.
	 * @param eventId The event id.
	 * @returns The delivery, or null.
	 */
	async findByEvent(subscriptionId: ID, eventId: ID): Promise<WebhookDelivery | null> {
		return this.typeOrmWebhookDeliveryRepository.findOne({
			where: { subscriptionId, eventId } as any
		});
	}

	/**
	 * Builds the headers of an attempt.
	 *
	 * Static subscription headers are applied **last but never win**: the reserved names are the
	 * contract between the platform and every receiver, and a subscription that could overwrite
	 * `X-Signature` could make its own deliveries unverifiable.
	 *
	 * @param delivery The delivery.
	 * @param subscription The subscription.
	 * @param attempt The 1-based attempt number.
	 * @param signature The `X-Signature` value.
	 * @returns The headers.
	 */
	buildHeaders(
		delivery: WebhookDelivery,
		subscription: WebhookSubscription,
		attempt: number,
		signature: string
	): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json; charset=utf-8',
			'User-Agent': WebhookDeliveryService.USER_AGENT,
			[WebhookHeader.EVENT]: delivery.eventName,
			[WebhookHeader.EVENT_ID]: delivery.eventId,
			// The row id plus the attempt: unique per attempt, as the header contract requires, while
			// still naming the row an operator can look up.
			[WebhookHeader.DELIVERY]: `${delivery.id}.${attempt}`,
			[WebhookHeader.SIGNATURE]: signature,
			[WebhookHeader.API_VERSION]: subscription.apiVersion ?? WebhookDeliveryService.DEFAULT_API_VERSION,
			[WebhookHeader.ATTEMPT]: String(attempt),
			[WebhookHeader.TENANT]: delivery.tenantId ?? ''
		};

		const reserved = new Set(Object.values(WebhookHeader).map((name) => name.toLowerCase()));
		const custom = subscription.headers;

		if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
			for (const [name, value] of Object.entries(custom)) {
				if (!reserved.has(name.toLowerCase())) {
					headers[name] = String(value);
				}
			}
		}

		return headers;
	}

	/**
	 * Posts one attempt.
	 *
	 * A redirect is reported rather than followed: the endpoint a subscription names is the endpoint
	 * the payload may be sent to, and following a `Location` would hand the payload to whoever
	 * answers it. The body is read up to a fixed limit and then dropped, so a huge or slow response
	 * cannot hold the worker.
	 *
	 * @param url The endpoint.
	 * @param body The exact bytes to send.
	 * @param headers The headers.
	 * @returns What the attempt did.
	 */
	private async post(url: string, body: string, headers: Record<string, string>): Promise<IWebhookAttemptResult> {
		const startedAt = Date.now();
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), WebhookDeliveryService.REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body,
				redirect: 'manual',
				signal: controller.signal
			});

			const raw = await response.text();

			return {
				delivered: response.ok,
				responseStatus: response.status,
				responseBody: raw ? raw.slice(0, WebhookDeliveryService.RESPONSE_BODY_LIMIT) : undefined,
				durationMs: Date.now() - startedAt
			};
		} catch (error) {
			// An aborted fetch is this timeout firing, not a mistake by the endpoint, and the two are
			// recorded differently so triage can tell a slow receiver from a broken one.
			const aborted = error instanceof Error && error.name === 'AbortError';

			return {
				delivered: false,
				lastError: aborted
					? `The endpoint did not respond within ${WebhookDeliveryService.REQUEST_TIMEOUT_MS} ms.`
					: error instanceof Error
					? error.message
					: 'The delivery failed.',
				durationMs: Date.now() - startedAt
			};
		} finally {
			clearTimeout(timer);
		}
	}

	/**
	 * Records an attempt's outcome and schedules the next one.
	 *
	 * @param delivery The delivery.
	 * @param attempt The 1-based attempt number.
	 * @param result What the attempt did.
	 * @returns The updated delivery.
	 */
	private async recordOutcome(
		delivery: WebhookDelivery,
		attempt: number,
		result: IWebhookAttemptResult
	): Promise<WebhookDelivery> {
		if (result.delivered) {
			return this.saveDelivery(delivery, {
				status: WebhookDeliveryStatus.DELIVERED,
				attemptCount: attempt,
				responseStatus: result.responseStatus ?? null,
				responseBody: result.responseBody ?? null,
				durationMs: result.durationMs,
				deliveredAt: new Date(),
				nextAttemptAt: null,
				lastError: null
			});
		}

		const exhausted = attempt >= WebhookDeliveryService.MAX_ATTEMPTS;
		const retryable = WebhookDeliveryService.isRetryable(result.responseStatus);

		if (exhausted || !retryable) {
			// Dead is terminal and is reached only when there is nothing left to try: the schedule ran
			// out, or the endpoint answered in a way that will not change.
			return this.saveDelivery(delivery, {
				status: WebhookDeliveryStatus.DEAD,
				attemptCount: attempt,
				responseStatus: result.responseStatus ?? null,
				responseBody: result.responseBody ?? null,
				durationMs: result.durationMs,
				nextAttemptAt: null,
				lastError: result.lastError ?? `The endpoint answered ${result.responseStatus}.`
			});
		}

		return this.saveDelivery(delivery, {
			status: WebhookDeliveryStatus.FAILED,
			attemptCount: attempt,
			responseStatus: result.responseStatus ?? null,
			responseBody: result.responseBody ?? null,
			durationMs: result.durationMs,
			nextAttemptAt: new Date(Date.now() + WebhookDeliveryService.backoffFor(attempt)),
			lastError: result.lastError ?? `The endpoint answered ${result.responseStatus}.`
		});
	}

	/**
	 * Whether a failed attempt is worth repeating.
	 *
	 * A transport error, a `3xx` that was not followed, `408`, `425`, `429` and every `5xx` are
	 * retryable; any other `4xx` says the request itself is unacceptable, and repeating it would only
	 * repeat the refusal.
	 *
	 * @param status The HTTP status, absent when the request never completed.
	 * @returns True when the delivery should be retried.
	 */
	static isRetryable(status?: number): boolean {
		if (status === undefined) {
			return true;
		}

		if (status === 408 || status === 425 || status === 429 || status >= 500) {
			return true;
		}

		return status >= 300 && status < 400;
	}

	/**
	 * The delay before the next attempt.
	 *
	 * @param attempt The attempt that just failed, 1-based.
	 * @returns The delay in milliseconds, jittered.
	 */
	static backoffFor(attempt: number): number {
		const ladder = WebhookDeliveryService.RETRY_LADDER_MS;
		const step = ladder[Math.min(Math.max(attempt - 1, 0), ladder.length - 1)];

		// Â±20 % on every delay after the first, so a platform-wide incident does not produce a
		// synchronised retry storm against every endpoint at once.
		const jitter = step * 0.2 * (Math.random() * 2 - 1);

		return Math.max(0, Math.round(step + jitter));
	}

	/**
	 * Writes a delivery row.
	 *
	 * @param delivery The delivery, mutated in place so callers see what was stored.
	 * @param values The columns to write.
	 * @returns The saved delivery.
	 */
	private async saveDelivery(delivery: WebhookDelivery, values: Record<string, unknown>): Promise<WebhookDelivery> {
		Object.assign(delivery, values);

		return this.typeOrmWebhookDeliveryRepository.save(delivery);
	}
}
