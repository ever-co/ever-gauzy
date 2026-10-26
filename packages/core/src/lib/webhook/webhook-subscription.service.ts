import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DeleteResult, FindOptionsWhere, IsNull } from 'typeorm';
import { ID, IWebhookSubscription, JsonData } from '@gauzy/contracts';
import { EncryptionService } from '../common/encryption/encryption.service';
import { CrudService } from '../core/crud/crud.service';
import { RequestContext } from '../core/context/request-context';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { refusalForEndpointHost } from './webhook-endpoint-policy';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhookEventPublisher } from './webhook-event.publisher';
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
 * The subscription and the secret that was generated for it.
 *
 * The secret is a member of this answer and of no type: it is readable at the two moments it is
 * generated — creation and rotation — and this is how those two operations hand it over. Everything
 * else the platform answers about a subscription carries the fingerprint instead.
 */
export interface IWebhookSubscriptionCredential {
	/** The subscription, with its secret replaced by a fingerprint. */
	subscription: IRedactedWebhookSubscription;
	/** The plaintext secret, which no later read can produce again. */
	secret: string;
	/** When the previous secret stops being accepted; absent on a creation, where there is none. */
	previousSecretValidUntil?: string;
}

/**
 * The narrowing a subscription list accepts.
 *
 * The two members the endpoint table names for the route: whether the endpoint is switched on, and
 * which channel it listens to. Both are columns, so both narrow the read rather than the answer.
 */
export interface IWebhookSubscriptionNarrowing {
	readonly isActive?: boolean;
	readonly channelId?: ID;
}

/**
 * The scope an event carries, stated rather than taken from a request.
 *
 * The dispatcher runs in a queue worker, where there is no caller and therefore no request context to
 * read a tenant from. The event itself is the only thing that knows whose fact it is, so the scope
 * travels as an argument — and a lookup that is handed no tenant answers with nothing rather than
 * with every tenant's endpoints, which is the difference between a fan-out and a data leak.
 */
export interface IWebhookSubscriptionScope {
	/** The tenant the event belongs to. Without one, nothing matches. */
	readonly tenantId?: ID;
	/** The organization the event belongs to; absent for a tenant-wide fact. */
	readonly organizationId?: ID;
	/** The channel the fact belongs to, when it is channel scoped. */
	readonly channelId?: ID;
}

/**
 * Manages outbound delivery endpoints.
 *
 * The secret never leaves this service in readable form except at the two moments it is genuinely
 * needed: when the operator creates or rotates it, and when the delivery runtime signs a payload.
 * Everything else — validation of the endpoint, the per-organization uniqueness of a URL, the
 * failure counters and the automatic disable — is state the delivery path depends on, so it lives
 * here rather than in the worker that happens to call it.
 *
 * **This service is where a switched-off subscription is announced.** The operator's own switch and
 * the circuit breaker's auto-disable both write `isActive = false` here, and both are announced from
 * here — so a subscriber learns that a subscription it watches is gone whichever of the two decided
 * it, and whichever protocol asked for it. Announcing in a controller or a resolver instead would
 * give the platform two producers of one fact and leave the other surface silent.
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
		private readonly encryptionService: EncryptionService,
		private readonly webhookEventPublisher: WebhookEventPublisher
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
	async createSubscription(input: IWebhookSubscriptionInput): Promise<IWebhookSubscriptionCredential> {
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
	 * @returns The subscription, the new secret and the instant the previous one stops being accepted.
	 * The secret is readable only here and at creation; the expiry is answered beside it because an
	 * operator handing a partner a new secret has to be able to say how long the old one still works.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async rotateSecret(id: ID): Promise<IWebhookSubscriptionCredential> {
		const subscription = await this.getSubscription(id);
		const secret = this.generateSecret();
		const previousSecretValidUntil = new Date(
			Date.now() + WebhookSubscriptionService.SECRET_ROTATION_GRACE_MS
		).toISOString();

		Object.assign(subscription, {
			secret: this.encryptionService.encrypt(secret),
			metadata: {
				...(isPlainRecord(subscription.metadata) ? subscription.metadata : {}),
				// Both values travel together: the delivery runtime reads the expiry to decide whether the
				// previous secret is still part of the signature header.
				previousSecret: subscription.secret,
				previousSecretExpiresAt: previousSecretValidUntil
			}
		});

		const saved = await this.typeOrmWebhookSubscriptionRepository.save(subscription);

		return { subscription: this.redact(saved), secret, previousSecretValidUntil };
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

		const stored = this.redact(await this.typeOrmWebhookSubscriptionRepository.save(subscription));

		// Announced from here rather than from the route, so the operator's switch and the circuit
		// breaker's auto-disable produce one fact with one shape, and the retry worker that sees a
		// disabled endpoint is told the same thing the operator who switched it off is.
		await this.webhookEventPublisher.subscriptionDisabled(stored, reason);

		return stored;
	}

	/**
	 * Records the outcome of one attempt.
	 *
	 * A success resets the failure counter — the counter is "consecutive failures", which is what makes
	 * it a usable signal — and a failure increments it. Crossing the threshold disables the endpoint,
	 * and a `410 Gone` disables it immediately: the receiver is telling the platform the endpoint is
	 * gone, and retrying that is pointless.
	 *
	 * @param id The subscription id.
	 * @param outcome What the endpoint answered.
	 * @returns The updated subscription. A write that crosses the auto-disable threshold is also where
	 * the switch-off is announced, because this is the only place that decision is made.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async recordAttempt(id: ID, outcome: { delivered: boolean; status?: number }): Promise<WebhookSubscription> {
		// The delivery runtime's own reader: this runs in the queue worker, which has no caller.
		const subscription = await this.getSubscriptionForDelivery(id);
		const at = new Date();
		let autoDisableReason: string | undefined;

		if (outcome.delivered) {
			Object.assign(subscription, { failureCount: 0, lastSuccessAt: at });
		} else {
			const failureCount = (subscription.failureCount ?? 0) + 1;
			const gone = outcome.status === 410;

			if (gone || failureCount >= WebhookSubscriptionService.AUTO_DISABLE_FAILURE_COUNT) {
				// The reason is stated here rather than left to the caller: the fact is a fact about
				// *this* write, and the threshold that produced it is this service's own constant.
				autoDisableReason = gone
					? 'The endpoint answered 410 Gone.'
					: `The endpoint refused ${failureCount} consecutive deliveries.`;

				Object.assign(subscription, { isActive: false, disabledAt: at });
			}

			Object.assign(subscription, { failureCount, lastFailureAt: at });
		}

		const saved = await this.typeOrmWebhookSubscriptionRepository.save(subscription);

		if (autoDisableReason) {
			await this.webhookEventPublisher.subscriptionDisabled(this.redact(saved), autoDisableReason);
		}

		return saved;
	}

	/**
	 * Reads a subscription of the caller's own scope.
	 *
	 * 🛑 **The reader every request-facing operation uses** — read, edit, removal, rotation and both
	 * switches, over REST and GraphQL alike. It used to read by id alone, and this service extends the
	 * plain `CrudService`, so nothing else narrowed the read: `TenantPermissionGuard` only compares the
	 * `Tenant-Id` header with the caller's own tenant. A tenant-A admin holding `WEBHOOKS_EDIT` could
	 * therefore re-point tenant B's endpoint at a URL of their choosing — and receive every later event
	 * of B — rotate B's secret and read the new one, read B's custom headers, or remove B's subscription
	 * and its delivery log, knowing nothing but B's UUID.
	 *
	 * The scope is the list's own ({@link scopeOfTheCaller}): a row a caller cannot list is a row a
	 * caller cannot address. A row outside it answers exactly what a missing row answers, so a caller is
	 * never told that another tenant holds the identifier.
	 *
	 * The delivery runtime, which runs in a queue worker with no caller, reads through
	 * {@link getSubscriptionForDelivery} instead.
	 *
	 * @param id The subscription id.
	 * @returns The subscription.
	 * @throws NotFoundException when no subscription of that id is in the caller's scope.
	 */
	async getSubscription(id: ID): Promise<WebhookSubscription> {
		const scope = this.scopeOfTheCaller();
		const subscription = scope
			? await this.typeOrmWebhookSubscriptionRepository.findOne({
					where: { ...scope, id } as FindOptionsWhere<WebhookSubscription>
			  })
			: null;

		if (!subscription) {
			throw new NotFoundException('The webhook subscription does not exist.');
		}

		return subscription;
	}

	/**
	 * Reads a subscription for the delivery runtime, whatever tenant it belongs to.
	 *
	 * 🛑 **Runtime only — never reachable from a request.** The first attempt is made by the outbox
	 * dispatch consumer and every later one by the retry worker; both run in a queue job, where there
	 * is no caller and therefore no scope to narrow on, and the delivery row they hold already names the
	 * subscription it belongs to. A route or a resolver must use {@link getSubscription}.
	 *
	 * @param id The subscription id, as a delivery row names it.
	 * @returns The subscription.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async getSubscriptionForDelivery(id: ID): Promise<WebhookSubscription> {
		const subscription = await this.typeOrmWebhookSubscriptionRepository.findOne({
			where: { id } as FindOptionsWhere<WebhookSubscription>
		});

		if (!subscription) {
			throw new NotFoundException('The webhook subscription does not exist.');
		}

		return subscription;
	}

	/**
	 * Removes a subscription of the caller's own scope and, by the table's own cascade, its delivery log.
	 *
	 * The row is read through the scoped reader first: the CRUD base's `delete(id)` narrows on the id
	 * alone, which is how a caller could remove another tenant's subscription.
	 *
	 * @param id The subscription id.
	 * @returns The store's delete result.
	 * @throws NotFoundException when no subscription of that id is in the caller's scope.
	 */
	async deleteSubscription(id: ID): Promise<DeleteResult> {
		const subscription = await this.getSubscription(id);

		return this.delete(subscription.id);
	}

	/**
	 * The criteria that put a subscription inside the caller's scope, or undefined when no credential
	 * resolved a tenant.
	 *
	 * The tenant and the organization the request resolved, the organization as stated or, when none
	 * is selected, the tenant-wide rows — the same two columns the list narrows on and `create` stamps,
	 * so the rows a caller lists, the rows it creates and the rows it can address by id are one set. A
	 * caller with no tenant is given nothing rather than everything: the guards in front of these
	 * routes refuse such a request, so reaching here without one means the guards did not run.
	 *
	 * @returns The criteria, or undefined.
	 */
	private scopeOfTheCaller(): FindOptionsWhere<WebhookSubscription> | undefined {
		const tenantId = RequestContext.currentTenantId();

		if (!tenantId) {
			return undefined;
		}

		const organizationId = RequestContext.currentOrganizationId();

		return { tenantId, organizationId: organizationId ?? IsNull() } as FindOptionsWhere<WebhookSubscription>;
	}

	/**
	 * Reads a subscription as either protocol may answer with it.
	 *
	 * The secret is replaced by its fingerprint here rather than in each surface, because the raw row
	 * carries the encrypted secret and a node read that handed it over would be the one route through
	 * which a caller could read a subscription's stored material.
	 *
	 * @param id The subscription id.
	 * @returns The subscription, secrets replaced by fingerprints.
	 * @throws NotFoundException when the subscription does not exist.
	 */
	async getRedactedSubscription(id: ID): Promise<IRedactedWebhookSubscription> {
		return this.redact(await this.getSubscription(id));
	}

	/**
	 * Lists the subscriptions of the current organization.
	 *
	 * @param narrowing The columns to narrow on, when the caller stated any.
	 * @returns The subscriptions, secrets replaced by fingerprints.
	 */
	async listSubscriptions(narrowing: IWebhookSubscriptionNarrowing = {}): Promise<IRedactedWebhookSubscription[]> {
		const scope = this.scopeOfTheCaller();

		if (!scope) {
			return [];
		}

		let where: Record<string, unknown> = { ...scope };

		for (const [column, value] of Object.entries(narrowing)) {
			// A member that was not stated is left out rather than written as `undefined`: a repository
			// handed an explicit `undefined` asks the store for a row whose column *is* null, which is a
			// different question from "do not narrow on this column". `isActive` is the one member whose
			// `false` is a question rather than an absence, so it is kept when it is stated.
			if (value !== undefined && value !== null) {
				where[column] = value;
			}
		}

		const subscriptions = await this.typeOrmWebhookSubscriptionRepository.find({ where: where as never });

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

		return subscriptions.filter((subscription) =>
			WebhookSubscriptionService.selects(subscription, eventName, channelId)
		);
	}

	/**
	 * The active subscriptions of a stated scope that should receive an event.
	 *
	 * The same selection as `findMatching`, for the one caller that cannot supply a request context:
	 * the outbox dispatcher, which runs in a queue worker long after the request that appended the
	 * event has ended. The scope is therefore read from the event rather than from the caller, and the
	 * per-row decision is the same static predicate both reads use — so a subscription's patterns, its
	 * channel and its disabled switch mean one thing whichever read asked.
	 *
	 * **A scope with no tenant matches nothing.** A background caller that lost its scope would
	 * otherwise ask the store for every subscription of every tenant and post one tenant's payloads to
	 * another tenant's endpoint. Answering with nothing is the safe reading of a question that was not
	 * asked properly, and it mirrors what the outbox's own diagnostic reads do with a row nobody owns.
	 *
	 * **An event with no organization is the tenant-wide fact**, so every subscription of the tenant is
	 * selected; an event that names one selects that organization's subscriptions and the tenant-wide
	 * endpoints beside them. That is the same reading of a nullable organization the platform applies
	 * to a shared row everywhere else, rather than a rule this fan-out invented.
	 *
	 * @param eventName The event name.
	 * @param scope The tenant, organization and channel the event carries.
	 * @returns The matching subscriptions, empty when the scope names no tenant.
	 */
	async findMatchingInScope(eventName: string, scope: IWebhookSubscriptionScope): Promise<WebhookSubscription[]> {
		const { tenantId, organizationId, channelId } = scope;

		if (!tenantId) {
			return [];
		}

		// Two criteria ORed rather than one, because TypeORM reads an `organizationId` of `undefined` as
		// "do not narrow on this column" and an explicit null as "this column is null": the first would
		// hand back every organization's endpoints, and the second alone would hide every tenant-wide
		// endpoint from an event that names an organization.
		const where = organizationId
			? [
					{ isActive: true, tenantId, organizationId },
					{ isActive: true, tenantId, organizationId: IsNull() }
			  ]
			: [{ isActive: true, tenantId }];

		const subscriptions = await this.typeOrmWebhookSubscriptionRepository.find({ where: where as never });

		return subscriptions.filter((subscription) =>
			WebhookSubscriptionService.selects(subscription, eventName, channelId)
		);
	}

	/**
	 * Whether one subscription should receive one event.
	 *
	 * The per-row half of both matching reads, kept as one predicate so the two can never drift: a
	 * second copy of these three rules is how a subscription comes to receive an event over one path
	 * and not over the other, with nothing anywhere reporting the difference.
	 *
	 * A subscription that names no channel listens to every channel, and an event that carries no
	 * channel is not channel scoped and therefore reaches every subscription — the narrowing applies
	 * only when both sides state one.
	 *
	 * @param subscription The stored subscription.
	 * @param eventName The event name.
	 * @param channelId The channel the fact belongs to, when it is channel scoped.
	 * @returns True when the event should be delivered to this subscription.
	 */
	static selects(subscription: WebhookSubscription, eventName: string, channelId?: ID): boolean {
		return (
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
		const subscription = await this.getSubscriptionForDelivery(id);

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
	 * under any aggregate. A `*` segment matches exactly one segment — including the whole name only
	 * in the single-segment form — which is what makes `order.*` unusable as an accidental catch-all.
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
	 * development installation may set — which is refused outright once the platform runs in
	 * production, because an unencrypted webhook leaks every payload it carries.
	 *
	 * **The scheme was the only thing this checked**, and the scheme is not what makes an endpoint
	 * safe to call. A tenant user who may create a subscription could point one at
	 * `https://169.254.169.254/`, at a database admin port on the pod network, or at a service mesh's
	 * control plane, and then read four kilobytes of each response back out through the delivery log
	 * — a read API the same user already has. `refusalForEndpointHost` is the rule about *where* an
	 * endpoint may point; the delivery path applies it again against the address the host actually
	 * resolves to, because a name can answer differently a minute later.
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

		const refusal = refusalForEndpointHost(parsed);

		if (refusal) {
			throw new BadRequestException(refusal);
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
