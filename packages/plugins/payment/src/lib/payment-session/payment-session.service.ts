import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DecimalString, ID, IPagination } from '@gauzy/contracts';
import { CrudService, EventBus, Money, RequestContext } from '@gauzy/core';
import { PaymentSession } from './payment-session.entity';
import { TypeOrmPaymentSessionRepository } from './repository/type-orm-payment-session.repository';
import { MikroOrmPaymentSessionRepository } from './repository/mikro-orm-payment-session.repository';
import {
	IPaymentSession,
	IPaymentSessionCreateInput,
	IPaymentSessionUpdateInput,
	PaymentSessionStatus
} from '../payment.types';
import { PaymentCollectionService } from '../payment-collection/payment-collection.service';
import { PaymentProviderService } from '../payment-provider/payment-provider.service';
import { PAYMENT_SETTINGS } from '../payment.settings';
import { PaymentAuthorizedEvent, PaymentCanceledEvent, PaymentFailedEvent } from '../events';

/**
 * The lifetime of a session: created at the provider, authorised, captured or closed.
 *
 * Read the rules of this service as one rule with four faces.
 *
 * 1. **One active session per `(collection, provider)`.** A new attempt for the same pair supersedes
 *    the previous one — it is cancelled with `metadata.supersededBy`, never deleted — and an attempt
 *    that already reached `AUTHORIZED` refuses to be superseded at all, because the money it reserved
 *    is real. That is what makes a retry a retry rather than a second charge.
 * 2. **An off-session attempt is never asked for a next action.** With `paymentMethodTokenId` set,
 *    `clientSecret` stays null and `REQUIRES_MORE` is unreachable: there is nobody to complete a
 *    redirect, so a provider that answers with one is recorded as a decline, not parked in a state
 *    that would expire in silence.
 * 3. **A terminal attempt is never re-opened, and an approval delivered twice is counted once.**
 *    `CAPTURED`, `CANCELED`, `ERROR` and `EXPIRED` are final, so a retry is a new row with its own
 *    idempotency key — which is what keeps the history of what the buyer tried intact — and an attempt
 *    that already stands at `AUTHORIZED` answers a re-delivered provider approval with the
 *    authorisation already on record rather than reserving its amount a second time.
 * 4. **Every amount moves the collection.** Authorising raises the collection's `authorizedAmount`
 *    and voiding releases it, through the collection service, so the two can never disagree.
 */
@Injectable()
export class PaymentSessionService extends CrudService<PaymentSession> {
	/** Statuses a session can no longer leave. */
	private static readonly TERMINAL: PaymentSessionStatus[] = [
		PaymentSessionStatus.CAPTURED,
		PaymentSessionStatus.CANCELED,
		PaymentSessionStatus.ERROR,
		PaymentSessionStatus.EXPIRED
	];

	/** Statuses the expiry sweep reads. */
	private static readonly OPEN: PaymentSessionStatus[] = [
		PaymentSessionStatus.PENDING,
		PaymentSessionStatus.PENDING_AUTHORIZATION,
		PaymentSessionStatus.REQUIRES_MORE
	];

	/**
	 * The declared default lifetime of a session, read from the setting this package contributes so
	 * that the fallback and the documented default cannot drift apart.
	 */
	private static readonly DEFAULT_TTL_MINUTES = Number(
		PAYMENT_SETTINGS.find((setting) => setting.key === 'payment.sessionTtlMinutes')?.default ?? 60
	);

	constructor(
		readonly typeOrmPaymentSessionRepository: TypeOrmPaymentSessionRepository,
		readonly mikroOrmPaymentSessionRepository: MikroOrmPaymentSessionRepository,
		private readonly paymentCollectionService: PaymentCollectionService,
		private readonly paymentProviderService: PaymentProviderService,
		private readonly eventBus: EventBus
	) {
		super(typeOrmPaymentSessionRepository, mikroOrmPaymentSessionRepository);
	}

	/**
	 * The tenant and organization of the caller, which every query in this service is scoped to.
	 */
	protected get scope(): { tenantId: ID; organizationId: ID } {
		return {
			tenantId: RequestContext.currentTenantId(),
			organizationId: RequestContext.currentOrganizationId()
		};
	}

	/**
	 * Opens an attempt against a collection, superseding the previous live attempt for the same
	 * provider.
	 *
	 * @param input The attempt to open.
	 * @returns The stored session.
	 * @throws NotFoundException when the collection or the provider is not in the caller's scope.
	 * @throws BadRequestException when the provider is disabled, when the attempt would take the
	 * collection past its amount, when a live attempt for the same provider is already authorised, or
	 * when an off-session attempt asks for a client secret or for a next action.
	 */
	async openSession(input: IPaymentSessionCreateInput): Promise<IPaymentSession> {
		const collection = await this.paymentCollectionService.findCollectionOrFail(input.collectionId);
		const provider = await this.paymentProviderService.findProviderOrFail(input.providerId);

		this.paymentProviderService.assertEnabled(provider);

		if (input.currency && input.currency.trim().toUpperCase() !== collection.currency) {
			throw new BadRequestException(
				`Session currency '${input.currency}' does not match collection currency '${collection.currency}'.`
			);
		}

		const amount = this.toMoney(input.amount, collection.currency);

		if (!amount.isPositive()) {
			throw new BadRequestException('PAYMENT_SESSION_AMOUNT_INVALID');
		}

		const previous = await this.findActiveSession(collection.id, provider.id);

		if (previous && previous.status === PaymentSessionStatus.AUTHORIZED) {
			throw new BadRequestException(
				`Collection '${collection.id}' already has an authorised session with provider '${provider.code}'.`
			);
		}

		// The attempt this one supersedes is not counted against it: it is about to be cancelled, so
		// counting it would refuse the retry of an attempt that holds the whole collection amount — the
		// ordinary retry — as if the collection were being asked for twice.
		await this.assertCollectionCapacity(
			collection.id,
			collection.currency,
			amount.amount,
			collection.amount,
			previous?.id
		);
		this.assertOffSessionShape(input);

		if (previous) {
			await this.update(previous.id, {
				status: PaymentSessionStatus.CANCELED,
				metadata: { ...(previous.metadata ?? {}), superseded: true }
			} as never);
		}

		const session = await this.create({
			...input,
			amount: amount.amount,
			currency: collection.currency,
			status: PaymentSessionStatus.PENDING,
			providerId: provider.id,
			collectionId: collection.id,
			clientSecret: input.paymentMethodTokenId ? null : input.clientSecret,
			expiresAt: input.expiresAt ?? this.defaultExpiry(),
			...this.scope
		} as never);

		if (previous) {
			await this.update(previous.id, {
				metadata: { ...(previous.metadata ?? {}), superseded: true, supersededBy: session.id }
			} as never);
		}

		await this.paymentCollectionService.markAwaiting(collection.id);

		return this.findSessionOrFail(session.id);
	}

	/**
	 * Updates the descriptive fields of a session. The status, the amount and the provider are not
	 * among them: they move through the operations that mean something.
	 *
	 * @param id The session to update.
	 * @param input The fields to change.
	 * @returns The stored session.
	 */
	async updateSession(id: ID, input: IPaymentSessionUpdateInput): Promise<IPaymentSession> {
		const session = await this.findSessionOrFail(id);

		if (this.isTerminal(session.status)) {
			throw new BadRequestException('PAYMENT_SESSION_ALREADY_CLOSED');
		}

		const { status, amount, currency, providerId, collectionId, ...changes } = input;
		void status;
		void amount;
		void currency;
		void providerId;
		void collectionId;

		await this.update(id, { ...changes } as never);

		return this.findSessionOrFail(id);
	}

	/**
	 * Loads a session that belongs to the caller's organization.
	 *
	 * @param id The session to load.
	 * @returns The session.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findSessionOrFail(id: ID): Promise<IPaymentSession> {
		const session = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!session) {
			throw new NotFoundException('PAYMENT_SESSION_NOT_FOUND');
		}

		return session;
	}

	/**
	 * Resolves the live attempt of a `(collection, provider)` pair.
	 *
	 * @param collectionId The collection.
	 * @param providerId The provider.
	 * @returns The live session, or null when the pair has none.
	 */
	async findActiveSession(collectionId: ID, providerId: ID): Promise<IPaymentSession | null> {
		const sessions: IPaymentSession[] = await this.find({
			where: {
				collectionId,
				providerId,
				status: { $notIn: PaymentSessionService.TERMINAL },
				...this.scope
			} as never
		});

		return sessions.length ? sessions[0] : null;
	}

	/**
	 * Paginates the sessions of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of sessions.
	 */
	async findSessions(options: Record<string, unknown> = {}): Promise<IPagination<IPaymentSession>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Records the provider's approval of an attempt and reserves the amount on its collection.
	 *
	 * **The approval is counted once, however often it is delivered.** A session that already stands at
	 * `AUTHORIZED` has had its answer recorded — the status, `authorizedAt`, the collection's
	 * `authorizedAmount` and the published event — so a re-delivered answer returns the stored
	 * authorisation rather than reserving the amount a second time. A provider that retries a callback
	 * it never got an acknowledgement for must not be able to authorise the same money twice, and
	 * `AUTHORIZED` is deliberately not one of the statuses `TERMINAL` lists: the money it holds is
	 * still real and still releasable, so `voidSession` and the capture path keep working on it.
	 *
	 * @param id The session to authorise.
	 * @param input Optional data the provider returned with the approval.
	 * @returns The stored session, and on a re-delivery the authorisation already on record.
	 * @throws BadRequestException when the attempt is expired, already captured, or off-session and
	 * answered with a next action the buyer cannot perform.
	 * @throws NotFoundException when the session is not in the caller's scope.
	 */
	async authorizeSession(id: ID, input: IPaymentSessionUpdateInput = {}): Promise<IPaymentSession> {
		const session = await this.findSessionOrFail(id);

		if (session.status === PaymentSessionStatus.AUTHORIZED) {
			return session;
		}

		if (session.status === PaymentSessionStatus.EXPIRED || this.isPast(session.expiresAt)) {
			throw new BadRequestException('PAYMENT_SESSION_EXPIRED');
		}

		if (session.status === PaymentSessionStatus.CAPTURED) {
			throw new BadRequestException('PAYMENT_ALREADY_CAPTURED');
		}

		if (this.isTerminal(session.status)) {
			throw new BadRequestException('PAYMENT_SESSION_ALREADY_CLOSED');
		}

		if (session.paymentMethodTokenId && input.status === PaymentSessionStatus.REQUIRES_MORE) {
			// A provider that asks a stored instrument for a next action is asking a buyer who is not
			// there: recorded as a decline, never parked in a state that would expire in silence.
			throw new BadRequestException('PAYMENT_AUTHORIZATION_FAILED');
		}

		const provider = await this.paymentProviderService.findProviderOrFail(session.providerId);
		this.paymentProviderService.assertEnabled(provider);

		const collection = await this.paymentCollectionService.findCollectionOrFail(session.collectionId);
		this.paymentCollectionService.assertCanAuthorize(collection, session.amount);

		await this.update(id, {
			status: PaymentSessionStatus.AUTHORIZED,
			authorizedAt: new Date(),
			data: { ...(session.data ?? {}), ...(input.data ?? {}) }
		} as never);

		await this.paymentCollectionService.recordAuthorization(collection.id, session.amount);
		this.eventBus.publish(
			new PaymentAuthorizedEvent(session.id, session.amount, session.currency, collection.id, session.organizationId)
		);

		return this.findSessionOrFail(id);
	}

	/**
	 * Records that the provider refused an attempt.
	 *
	 * The session goes to `ERROR`, which is one of the statuses that free the `(collection, provider)`
	 * pair for a retry, and the collection is told only when the attempt was the last thing holding
	 * it open. The failure is published with the code the refusal is recorded under, because that is
	 * what a client branches on.
	 *
	 * @param id The session that failed.
	 * @param reason The code the failure is recorded with.
	 * @returns The stored session.
	 * @throws BadRequestException when the attempt has already reached a terminal status.
	 */
	async failSession(id: ID, reason = 'PAYMENT_AUTHORIZATION_FAILED'): Promise<IPaymentSession> {
		const session = await this.findSessionOrFail(id);

		if (this.isTerminal(session.status)) {
			throw new BadRequestException('PAYMENT_SESSION_ALREADY_CLOSED');
		}

		await this.update(id, {
			status: PaymentSessionStatus.ERROR,
			metadata: { ...(session.metadata ?? {}), lastError: reason }
		} as never);

		await this.paymentCollectionService.markFailed(session.collectionId);
		this.eventBus.publish(
			new PaymentFailedEvent(
				session.id,
				session.collectionId,
				session.amount,
				session.currency,
				reason,
				session.organizationId
			)
		);

		return this.findSessionOrFail(id);
	}

	/**
	 * Re-reads the state of an attempt. A session past its expiry is closed here, which is the half of
	 * the refresh that this package owns: what the provider answered is written by the call that
	 * reached it, not by a read.
	 *
	 * @param id The session to refresh.
	 * @returns The stored session.
	 */
	async refreshSession(id: ID): Promise<IPaymentSession> {
		const session = await this.findSessionOrFail(id);

		if (PaymentSessionService.OPEN.includes(session.status) && this.isPast(session.expiresAt)) {
			return this.expireSession(session);
		}

		return session;
	}

	/**
	 * Voids an attempt: it is cancelled and the authorisation it holds is released.
	 *
	 * @param id The session to void.
	 * @param metadata Optional diagnostic detail, such as the reason the operator gave.
	 * @returns The stored session.
	 * @throws BadRequestException when the attempt is already closed.
	 */
	async voidSession(id: ID, metadata: Record<string, unknown> = {}): Promise<IPaymentSession> {
		const session = await this.findSessionOrFail(id);

		if (this.isTerminal(session.status)) {
			throw new BadRequestException('PAYMENT_SESSION_ALREADY_CLOSED');
		}

		const released = session.status === PaymentSessionStatus.AUTHORIZED ? session.amount : '0';

		await this.update(id, {
			status: PaymentSessionStatus.CANCELED,
			metadata: { ...(session.metadata ?? {}), ...metadata }
		} as never);

		if (Money.of(released, session.currency).isPositive()) {
			await this.paymentCollectionService.recordCancellation(session.collectionId, released);
		}

		this.eventBus.publish(
			new PaymentCanceledEvent(
				session.id,
				session.collectionId,
				released,
				session.currency,
				session.organizationId
			)
		);

		return this.findSessionOrFail(id);
	}

	/**
	 * Closes the attempts that have outlived their lifetime.
	 *
	 * The sweep is what makes a session that nobody answered stop holding money: `PENDING`,
	 * `PENDING_AUTHORIZATION` and `REQUIRES_MORE` past `expiresAt` become `EXPIRED`, and the
	 * collection is told, so the attempt it was waiting for is visibly gone.
	 *
	 * @param at The instant to sweep at, defaulting to now.
	 * @returns The sessions that were expired.
	 */
	async expireOverdueSessions(at: Date = new Date()): Promise<IPaymentSession[]> {
		const sessions: IPaymentSession[] = await this.find({
			where: { status: { $in: PaymentSessionService.OPEN }, ...this.scope } as never
		});
		const expired: IPaymentSession[] = [];

		for (const session of sessions) {
			if (this.isPast(session.expiresAt, at)) {
				expired.push(await this.expireSession(session));
			}
		}

		return expired;
	}

	/**
	 * Expires one attempt.
	 *
	 * @param session The session to expire.
	 * @returns The stored session.
	 */
	private async expireSession(session: IPaymentSession): Promise<IPaymentSession> {
		await this.update(session.id, { status: PaymentSessionStatus.EXPIRED } as never);
		await this.paymentCollectionService.markFailed(session.collectionId);
		this.eventBus.publish(
			new PaymentFailedEvent(
				session.id,
				session.collectionId,
				session.amount,
				session.currency,
				'PAYMENT_SESSION_EXPIRED',
				session.organizationId
			)
		);

		return this.findSessionOrFail(session.id);
	}

	/**
	 * Refuses an attempt whose amount would take the collection past what it is for.
	 *
	 * The collection is authorised once, as a whole: its live attempts must add up to what it asks
	 * for, or a split payment would collect more than the order. The attempt being superseded is left
	 * out of the sum, because it is cancelled as part of opening this one and counting both would make
	 * a retry for the whole amount look like a second charge.
	 *
	 * @param collectionId The collection.
	 * @param currency The collection currency.
	 * @param amount The amount of the new attempt.
	 * @param collectionAmount The amount the collection is for.
	 * @param supersededId The live attempt this one replaces, when there is one.
	 * @throws BadRequestException when the live attempts would exceed the collection amount.
	 */
	private async assertCollectionCapacity(
		collectionId: ID,
		currency: string,
		amount: DecimalString,
		collectionAmount: DecimalString,
		supersededId?: ID
	): Promise<void> {
		const live: IPaymentSession[] = await this.find({
			where: { collectionId, status: { $notIn: PaymentSessionService.TERMINAL } } as never
		});
		const total = live
			.filter((session) => session.id !== supersededId)
			.reduce((sum, session) => sum.add(Money.of(session.amount, currency)), Money.of(amount, currency));

		if (total.greaterThan(Money.of(collectionAmount, currency))) {
			throw new BadRequestException('PAYMENT_COLLECTION_MISMATCH');
		}
	}

	/**
	 * Refuses an off-session attempt that carries a client secret, or one that asks to wait for a
	 * buyer who is not there.
	 *
	 * @param input The attempt being opened.
	 * @throws BadRequestException when the shape contradicts the off-session path.
	 */
	private assertOffSessionShape(input: IPaymentSessionCreateInput): void {
		if (!input.paymentMethodTokenId) {
			return;
		}

		if (input.clientSecret) {
			throw new BadRequestException(
				'An off-session attempt charges a saved instrument and issues no client secret.'
			);
		}

		if (input.status === PaymentSessionStatus.REQUIRES_MORE) {
			throw new BadRequestException('REQUIRES_MORE is unreachable off-session: no buyer can complete the action.');
		}
	}

	/**
	 * Whether a status is final.
	 *
	 * @param status The status to test.
	 * @returns True when the session can no longer change.
	 */
	private isTerminal(status: PaymentSessionStatus): boolean {
		return PaymentSessionService.TERMINAL.includes(status);
	}

	/**
	 * Whether an instant has passed.
	 *
	 * @param at The instant to test.
	 * @param now The reference instant.
	 * @returns True when `at` is set and lies before `now`.
	 */
	private isPast(at: Date | undefined, now: Date = new Date()): boolean {
		return Boolean(at) && new Date(at) < now;
	}

	/**
	 * The expiry instant of a new attempt.
	 *
	 * @returns Now plus the declared session lifetime.
	 */
	private defaultExpiry(): Date {
		return new Date(Date.now() + PaymentSessionService.DEFAULT_TTL_MINUTES * 60 * 1000);
	}

	/**
	 * Reads an exact decimal in a given currency.
	 *
	 * @param value The decimal to read.
	 * @param currency The currency it is in.
	 * @returns The value as a kernel money value.
	 * @throws BadRequestException when the amount is not an exact decimal.
	 */
	private toMoney(value: DecimalString | number, currency: string): Money {
		try {
			return Money.of(value, currency);
		} catch {
			throw new BadRequestException('PAYMENT_AMOUNT_INVALID');
		}
	}
}
