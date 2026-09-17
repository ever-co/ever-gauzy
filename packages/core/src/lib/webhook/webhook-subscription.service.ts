import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ID, IWebhookSubscription, JsonData } from '@gauzy/contracts';
import { EncryptionService } from '../common/encryption/encryption.service';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { WebhookSubscription } from './webhook-subscription.entity';
import { TypeOrmWebhookSubscriptionRepository } from './repository/type-orm-webhook-subscription.repository';
import { MikroOrmWebhookSubscriptionRepository } from './repository/mikro-orm-webhook-subscription.repository';

/**
 * A subscription as an operator supplies it.
 */
export interface IWebhookSubscriptionInput {
	name: string;
	/** Absolute HTTPS endpoint. */
	url: string;
	/** Event names or patterns; an empty list is refused because it could never deliver anything. */
	events: string[];
	channelId?: ID;
	description?: string;
	/** Static extra headers; never allowed to override the reserved delivery headers. */
	headers?: Record<string, string>;
	apiVersion?: string;
	metadata?: JsonData;
}

/**
 * A subscription with its secret replaced by a fingerprint.
 *
 * This is the only shape the API may return: the secret is write-only, so a caller can tell two
 * subscriptions apart by fingerprint but can never read one back.
 */
export interface IRedactedWebhookSubscription extends Omit<IWebhookSubscription, 'secret'> {
	secretFingerprint: string;
}

/**
 * Manages outbound delivery endpoints.
 *
 * The secret never leaves this service in readable form except at the two moments it is genuinely
 * needed: when the operator creates or rotates it, and when the delivery runtime signs a payload.
 * Everything else â€” validation of the endpoint, the per-organization uniqueness of a URL, the
 * failure counters and the automatic disable â€” is state the delivery path depends on, so it lives
 * here rather than in the worker that happens to call it.
 */
@Injectable()
export class WebhookSubscriptionService extends CrudService<WebhookSubscription> {
	/** Length of a generated signing secret, in bytes. */
	static readonly SECRET_BYTES = 32;

	/**
	 * Consecutive failures after which the endpoint is disabled.
	 *
	 * A subscription that has refused a hundred deliveries in a row is not coming back on its own, and
	 * continuing to call it costs the worker more than it can ever return.
	 */
	static readonly AUTO_DISABLE_FAILURE_COUNT = 100;

	/** How long the previous secret stays valid after a rotation. */
	static readonly SECRET_ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;

	constructor(
		readonly typeOrmWebhookSubscriptionRepository: TypeOrmWebhookSubscriptionRepository,
		readonly mikroOrmWebhookSubscriptionRepository: MikroOrmWebhookSubscriptionRepository,
		private readonly encryptionService: EncryptionService
	) {
		super(typeOrmWebhookSubscriptionRepository, mikroOrmWebhookSubscriptionRepository);
	}

	/**
	 * Creates a subscription.
	 *
	 * @param input The endpoint to subscribe.
	 * @returns The subscription and the secret, which is the only time the secret is readable.
	 * @throws BadRequestException when the endpoint or the event list is unusable.
	 * @throws ConflictException when the endpoint is already subscribed.
	 */
	async createSubscription(input: IWebhookSubscriptionInput
	): Promise<{ subscription: IRedactedWebhookSubscription; secret: string }> {
		this.assertEvents(input.events);
		this.assertUrlAllowed(input.url, input.metadata);

		const secret = this.generateSecret();
		const subscription = this.typeOrmWebhookSubscriptionRepository.create({
			name: input.name,
			url: input.url,
			secret: this.encryptionService.encrypt(secret),
			events: input.events,
			channelId: input.channelId,
			description: input.description,
			headers: input.headers,
			apiVersion: input.apiVersion ?? '1',
			metadata: input.metadata,
			failureCount: 0,
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		} as Partial<WebhookSubscription>);

		try {
			const saved = await this.typeOrmWebhookSubscriptionRepository.save(subscription);

			return { subscription: this.redact(saved), secret };
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			// One subscription per endpoint: a duplicate would double-deliver every matching event.
			throw new ConflictException('This endpoint is already subscribed in this organization.');
		}
	}

	/**
	 * Updates the mutable fields of a subscription.
	 *
	 * @param id The subscription id.
	 * @param input The fields to change.
	 * @returns The updated subscription.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async updateSubscription(id: ID, input: Partial<IWebhookSubscriptionInput>): Promise<IRedactedWebhookSubscription> {
		const subscription = await this.getSubscription(id);

		if (input.events) {
			this.assertEvents(input.events);
		}

		if (input.url && input.url !== subscription.url) {
			this.assertUrlAllowed(input.url, input.metadata ?? subscription.metadata);
		}

		const values: Partial<WebhookSubscription> = {};

		if (input.name !== undefined) values.name = input.name;
		if (input.url !== undefined) values.url = input.url;
		if (input.events !== undefined) values.events = input.events;
		if (input.channelId !== undefined) values.channelId = input.channelId;
		if (input.description !== undefined) values.description = input.description;
		if (input.headers !== undefined) values.headers = input.headers;
		if (input.apiVersion !== undefined) values.apiVersion = input.apiVersion;
		if (input.metadata !== undefined) values.metadata = input.metadata;

		Object.assign(subscription, values);

		try {
			return this.redact(await this.typeOrmWebhookSubscriptionRepository.save(subscription));
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			throw new ConflictException('This endpoint is already subscribed in this organization.');
		}
	}

	/**
	 * Rotates the signing secret.
	 *
	 * The previous secret stays valid for a grace window so the endpoint can be reconfigured without
	 * losing deliveries; the delivery runtime signs with both while it lasts.
	 *
	 * @param id The subscription id.
	 * @returns The subscription and the new secret, which is the only time it is readable.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async rotateSecret(id: ID): Promise<{ subscription: IRedactedWebhookSubscription; secret: string }> {
		const subscription = await this.getSubscription(id);
		const secret = this.generateSecret();

		Object.assign(subscription, {
			secret: this.encryptionService.encrypt(secret),
			metadata: {
				...(isPlainRecord(subscription.metadata) ? subscription.metadata : {}),
				// Both values travel together: the delivery runtime reads the expiry to decide whether the
				// previous secret is still part of the signature header.
				previousSecret: subscription.secret,
				previousSecretExpiresAt: new Date(Date.now() + WebhookSubscriptionService.SECRET_ROTATION_GRACE_MS).toISOString()
			}
		});

		const saved = await this.typeOrmWebhookSubscriptionRepository.save(subscription);

		return { subscription: this.redact(saved), secret };
	}

	/**
	 * Re-enables an endpoint an operator or the auto-disable rule switched off.
	 *
	 * @param id The subscription id.
	 * @returns The updated subscription.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async enable(id: ID): Promise<IRedactedWebhookSubscription> {
		const subscription = await this.getSubscription(id);

		// The failure counter is reset with the switch: keeping it would disable the subscription again
		// on its first hiccup after being re-enabled.
		Object.assign(subscription, { isActive: true, disabledAt: null, failureCount: 0 });

		return this.redact(await this.typeOrmWebhookSubscriptionRepository.save(subscription));
	}

	/**
	 * Disables an endpoint.
	 *
	 * @param id The subscription id.
	 * @param reason Why it was disabled, recorded for the operator who re-enables it.
	 * @returns The updated subscription.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async disable(id: ID, reason?: string): Promise<IRedactedWebhookSubscription> {
		const subscription = await this.getSubscription(id);

		Object.assign(subscription, {
			isActive: false,
			disabledAt: new Date(),
			metadata: {
				...(isPlainRecord(subscription.metadata) ? subscription.metadata : {}),
				disabledReason: reason ?? null
			}
		});

		return this.redact(await this.typeOrmWebhookSubscriptionRepository.save(subscription));
	}

	/**
	 * Records the outcome of one attempt.
	 *
	 * A success resets the failure counter â€” the counter is "consecutive failures", which is what makes
	 * it a usable signal â€” and a failure increments it. Crossing the threshold disables the endpoint,
	 * and a `410 Gone` disables it immediately: the receiver is telling the platform the endpoint is
	 * gone, and retrying that is pointless.
	 *
	 * @param id The subscription id.
	 * @param outcome What the endpoint answered.
	 * @returns The updated subscription.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async recordAttempt(id: ID, outcome: { delivered: boolean; status?: number }): Promise<WebhookSubscription> {
		const subscription = await this.getSubscription(id);
		const at = new Date();

		if (outcome.delivered) {
			Object.assign(subscription, { failureCount: 0, lastSuccessAt: at });
		} else {
			const failureCount = (subscription.failureCount ?? 0) + 1;
			const gone = outcome.status === 410;

			Object.assign(subscription, {
				failureCount,
				lastFailureAt: at,
				...(gone || failureCount >= WebhookSubscriptionService.AUTO_DISABLE_FAILURE_COUNT
					? { isActive: false, disabledAt: at }
					: {})
			});
		}

		return this.typeOrmWebhookSubscriptionRepository.save(subscription);
	}

	/**
	 * Reads a subscription.
	 *
	 * @param id The subscription id.
	 * @returns The subscription.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async getSubscription(id: ID): Promise<WebhookSubscription> {
		const subscription = await this.typeOrmWebhookSubscriptionRepository.findOne({ where: { id } as any });

		if (!subscription) {
			throw new NotFoundException('The webhook subscription does not exist.');
		}

		return subscription;
	}

	/**
	 * Lists the subscriptions of the current organization.
	 *
	 * @returns The subscriptions, secrets replaced by fingerprints.
	 */
	async listSubscriptions(): Promise<IRedactedWebhookSubscription[]> {
		const subscriptions = await this.typeOrmWebhookSubscriptionRepository.find({
			where: {
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});

		return subscriptions.map((subscription) => this.redact(subscription));
	}

	/**
	 * The active subscriptions that should receive an event.
	 *
	 * Matching happens after tenant scoping, so a subscription can never see another tenant's events,
	 * and a disabled subscription is never selected: deliveries already queued for it dead-letter on
	 * their own schedule rather than being lost.
	 *
	 * @param eventName The event name.
	 * @param channelId The channel the fact belongs to, when it is channel scoped.
	 * @returns The matching subscriptions.
	 */
	async findMatching(eventName: string, channelId?: ID): Promise<WebhookSubscription[]> {
		const subscriptions = await this.typeOrmWebhookSubscriptionRepository.find({
			where: {
				isActive: true,
				tenantId: RequestContext.currentTenantId(),
				organizationId: RequestContext.currentOrganizationId()
			} as any
		});

		return subscriptions.filter(
			(subscription) =>
				!subscription.disabledAt &&
				(!subscription.channelId || !channelId || subscription.channelId === channelId) &&
				WebhookSubscriptionService.matchesEvent(subscription.events, eventName)
		);
	}

	/**
	 * Replaces a subscription's secret with its fingerprint.
	 *
	 * @param subscription The stored subscription.
	 * @returns The projection the API may return.
	 */
	redact(subscription: WebhookSubscription): IRedactedWebhookSubscription {
		const { secret, ...rest } = subscription as WebhookSubscription & { secret?: string };

		return {
			...(rest as Omit<IWebhookSubscription, 'secret'>),
			secretFingerprint: WebhookSubscriptionService.fingerprint(secret ?? subscription.secret)
		};
	}

	/**
	 * Reveals a subscription's signing secret.
	 *
	 * Called by the delivery runtime and by nothing else: it is the one place the plaintext secret is
	 * needed, and it is needed for exactly as long as it takes to sign a body.
	 *
	 * @param id The subscription id.
	 * @returns The plaintext secret.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async revealSecret(id: ID): Promise<string> {
		const subscription = await this.getSubscription(id);

		return this.encryptionService.decrypt(subscription.secret);
	}

	/**
	 * The previous secret, while a rotation's grace window lasts.
	 *
	 * @param subscription The stored subscription.
	 * @returns The previous secret, or undefined when there is none or it has expired.
	 */
	previousSecretOf(subscription: WebhookSubscription): string | undefined {
		const metadata = isPlainRecord(subscription.metadata) ? subscription.metadata : {};
		const encrypted = metadata.previousSecret;
		const expiresAt = metadata.previousSecretExpiresAt;

		if (typeof encrypted !== 'string' || typeof expiresAt !== 'string') {
			return undefined;
		}

		if (new Date(expiresAt).getTime() <= Date.now()) {
			return undefined;
		}

		try {
			return this.encryptionService.decrypt(encrypted);
		} catch {
			// An undecryptable previous secret is not a reason to fail a delivery: signing with the
			// current secret is still correct for every endpoint that has finished rotating.
			return undefined;
		}
	}

	/**
	 * Whether a subscription's patterns select an event.
	 *
	 * @param patterns The subscribed patterns.
	 * @param eventName The event name.
	 * @returns True when the event should be delivered.
	 */
	static matchesEvent(patterns: string[] | undefined, eventName: string): boolean {
		if (!Array.isArray(patterns) || patterns.length === 0) {
			return false;
		}

		return patterns.some((pattern) => WebhookSubscriptionService.matchesPattern(pattern, eventName));
	}

	/**
	 * Whether one pattern selects an event.
	 *
	 * A pattern is dot-separated: `order.placed` matches exactly that event, `order.*` matches one
	 * more segment, `*` matches any event at any depth, and `*.payment.*` matches a payment event
	 * under any aggregate. A `*` segment matches exactly one segment â€” including the whole name only
	 * in the single-segment form â€” which is what makes `order.*` unusable as an accidental catch-all.
	 *
	 * @param pattern The subscribed pattern.
	 * @param eventName The event name.
	 * @returns True when the pattern selects the event.
	 */
	static matchesPattern(pattern: string, eventName: string): boolean {
		if (pattern === '*') {
			return true;
		}

		const patternSegments = pattern.split('.');
		const eventSegments = eventName.split('.');

		if (patternSegments.length !== eventSegments.length) {
			return false;
		}

		return patternSegments.every((segment, index) => segment === '*' || segment === eventSegments[index]);
	}

	/**
	 * A short, stable fingerprint of a secret.
	 *
	 * @param secret The secret.
	 * @returns The first eight hex characters of its SHA-256.
	 */
	static fingerprint(secret: string): string {
		return createHash('sha256').update(secret ?? '', 'utf8').digest('hex').slice(0, 8);
	}

	/**
	 * Generates a signing secret.
	 *
	 * @returns A 32-byte secret, hex encoded.
	 */
	private generateSecret(): string {
		return randomBytes(WebhookSubscriptionService.SECRET_BYTES).toString('hex');
	}

	/**
	 * Rejects an event list that could never deliver anything.
	 *
	 * @param events The subscribed patterns.
	 * @throws BadRequestException when the list is empty or malformed.
	 */
	private assertEvents(events: string[]): void {
		if (!Array.isArray(events) || events.length === 0) {
			throw new BadRequestException('A webhook subscription must subscribe to at least one event.');
		}

		if (events.some((event) => typeof event !== 'string' || !event.trim())) {
			throw new BadRequestException('A subscribed event must be a non-empty event name or pattern.');
		}
	}

	/**
	 * Rejects an endpoint the platform must not call.
	 *
	 * HTTPS is required, and the only escape is the explicit `metadata.allowInsecure = true` that a
	 * development installation may set â€” which is refused outright once the platform runs in
	 * production, because an unencrypted webhook leaks every payload it carries.
	 *
	 * @param url The endpoint.
	 * @param metadata The subscription metadata.
	 * @throws BadRequestException when the endpoint is not allowed.
	 */
	private assertUrlAllowed(url: string, metadata?: JsonData): void {
		let parsed: URL;

		try {
			parsed = new URL(url);
		} catch {
			throw new BadRequestException('A webhook endpoint must be an absolute URL.');
		}

		if (parsed.protocol === 'https:') {
			return;
		}

		const allowInsecure = isPlainRecord(metadata) && metadata.allowInsecure === true;

		if (!allowInsecure || process.env.NODE_ENV === 'production') {
			throw new BadRequestException('A webhook endpoint must use HTTPS.');
		}
	}
}

/**
 * Whether a JSON value is a plain object.
 *
 * @param value The value.
 * @returns True when it is an object that can be spread and read by key.
 */
function isPlainRecord(value: unknown): value is Record<string, any> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}
