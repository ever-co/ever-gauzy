import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ID, IPagination } from '@gauzy/contracts';
import { PaymentWebhookEvent } from './payment-webhook-event.entity';
import { TypeOrmPaymentWebhookEventRepository } from './repository/type-orm-payment-webhook-event.repository';
import { MikroOrmPaymentWebhookEventRepository } from './repository/mikro-orm-payment-webhook-event.repository';
import { PaymentScopedCrudService } from '../payment-scoped-crud.service';
import {
	IPaymentProvider,
	IPaymentWebhookEvent,
	IPaymentWebhookIntake,
	IPaymentWebhookIntakeInput,
	PaymentWebhookEventStatus
} from '../payment.types';
import { findCardDataField } from '../payment.validators';
import { PaymentProviderService } from '../payment-provider/payment-provider.service';

/**
 * The inbound provider callback log.
 *
 * The intake obeys one ordering rule, and everything else follows from it: **the payload row is
 * written before anything else happens.** Before the signature is judged, before the type is looked
 * up, before any state changes. A callback that cannot be verified is therefore still on record —
 * which is what a dispute is argued with — and a handler defect is replayable from the bytes that
 * caused it rather than from a provider's dashboard that forgets.
 *
 * Replay protection is the unique `(providerId, eventId)` pair: a provider that retries a callback
 * it never got an answer for is acknowledged with `{ received: true, duplicate: true }` and nothing
 * is processed twice.
 *
 * `IGNORED` and `FAILED` are different answers, deliberately. A validly signed event of a type the
 * provider's own event map does not name is `IGNORED` — nothing to do — while `FAILED` is reserved
 * for something to fix, and is what the retry schedule picks up. Mapping a new event type onto
 * `FAILED` would bury a real handler defect under a provider's new feature.
 *
 * No route ever accepts card data, and the intake is a route like any other: a payload carrying a
 * member named `number`, `pan`, `cvc`, `cvv`, `iban`, `accountNumber` or a free-text expiry is
 * refused with the documented code before the row is written, so the platform never stores what it
 * must not hold.
 */
@Injectable()
export class PaymentWebhookEventService extends PaymentScopedCrudService<PaymentWebhookEvent> {
	constructor(
		readonly typeOrmPaymentWebhookEventRepository: TypeOrmPaymentWebhookEventRepository,
		readonly mikroOrmPaymentWebhookEventRepository: MikroOrmPaymentWebhookEventRepository,
		private readonly paymentProviderService: PaymentProviderService
	) {
		super(typeOrmPaymentWebhookEventRepository, mikroOrmPaymentWebhookEventRepository);
	}

	/**
	 * Records an inbound callback, before anything is done with it.
	 *
	 * @param input The callback, exactly as the provider sent it.
	 * @returns The stored event and whether it was a duplicate of one already recorded.
	 * @throws NotFoundException when the provider the callback names is not registered.
	 * @throws BadRequestException when the payload carries card data, or when it carries no event
	 * identifier or is not an object.
	 */
	async intake(input: IPaymentWebhookIntakeInput): Promise<IPaymentWebhookIntake> {
		const provider = await this.resolveProvider(input);

		this.assertNoCardData(input.payload);

		if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
			throw new BadRequestException('PAYMENT_WEBHOOK_PAYLOAD_INVALID');
		}

		const eventId = input.eventId?.trim();

		if (!eventId) {
			throw new BadRequestException('PAYMENT_WEBHOOK_PAYLOAD_INVALID');
		}

		const existing = await this.findByProviderAndEvent(provider.id, eventId);

		if (existing) {
			// The replay guard: answered, acknowledged, and nothing done twice.
			return { event: existing, duplicate: true };
		}

		const event = await this.create({
			providerId: provider.id,
			eventId,
			type: input.type,
			payload: input.payload,
			signature: input.signature,
			receivedAt: input.receivedAt ?? new Date(),
			status: PaymentWebhookEventStatus.RECEIVED,
			attemptCount: 0,
			...this.scope
		} as never);

		return { event: await this.classify(event, provider), duplicate: false };
	}

	/**
	 * Records that the signature of a stored callback did not verify.
	 *
	 * The event stays on record with `FAILED` and the documented code, because an unsigned callback
	 * is evidence of an attempt rather than something to be quietly dropped.
	 *
	 * @param id The stored event.
	 * @param error The failure code to record.
	 * @returns The stored event.
	 */
	async markSignatureInvalid(id: ID, error = 'PAYMENT_WEBHOOK_SIGNATURE_INVALID'): Promise<IPaymentWebhookEvent> {
		return this.markFailed(id, error);
	}

	/**
	 * Records that a stored callback was handled.
	 *
	 * @param id The stored event.
	 * @returns The stored event.
	 */
	async markProcessed(id: ID): Promise<IPaymentWebhookEvent> {
		return this.settle(id, PaymentWebhookEventStatus.PROCESSED);
	}

	/**
	 * Records that a stored callback was validly signed but of a type this build does not handle.
	 *
	 * @param id The stored event.
	 * @returns The stored event.
	 */
	async markIgnored(id: ID): Promise<IPaymentWebhookEvent> {
		return this.settle(id, PaymentWebhookEventStatus.IGNORED);
	}

	/**
	 * Records a failed processing attempt and counts it.
	 *
	 * @param id The stored event.
	 * @param lastError What went wrong.
	 * @returns The stored event.
	 */
	async markFailed(id: ID, lastError?: string): Promise<IPaymentWebhookEvent> {
		const event = await this.findEventOrFail(id);

		await this.update(id, {
			status: PaymentWebhookEventStatus.FAILED,
			lastError,
			attemptCount: (event.attemptCount ?? 0) + 1
		} as never);

		return this.findEventOrFail(id);
	}

	/**
	 * Re-runs a stored callback through the same classification the intake uses.
	 *
	 * A `RECEIVED` event is re-classified; an `IGNORED` or `FAILED` one is re-classified too, because
	 * the map may have gained the type in the meantime. A `PROCESSED` event is refused unless the
	 * caller forces it: re-applying an effect that already landed is a money defect, so it takes an
	 * explicit decision rather than a retry.
	 *
	 * @param id The stored event.
	 * @param force Whether to re-classify an event that already succeeded.
	 * @returns The stored event.
	 * @throws BadRequestException when the event already succeeded and `force` is not set.
	 */
	async reprocess(id: ID, force = false): Promise<IPaymentWebhookEvent> {
		const event = await this.findEventOrFail(id);

		if (event.status === PaymentWebhookEventStatus.PROCESSED && !force) {
			throw new BadRequestException('PAYMENT_WEBHOOK_ALREADY_PROCESSED');
		}

		const provider = await this.paymentProviderService.findProviderOrFail(event.providerId);

		return this.classify(event, provider);
	}

	/**
	 * Loads a stored callback of the caller's organization.
	 *
	 * @param id The event to load.
	 * @returns The event.
	 * @throws NotFoundException when it does not exist inside the caller's scope.
	 */
	async findEventOrFail(id: ID): Promise<IPaymentWebhookEvent> {
		const event = await this.findOneByWhereOptions({ id, ...this.scope } as never);

		if (!event) {
			throw new NotFoundException('PAYMENT_WEBHOOK_EVENT_NOT_FOUND');
		}

		return event;
	}

	/**
	 * Resolves a stored callback by its provider and the provider's own event id.
	 *
	 * **An unseen pair is an answer, not a refusal.** The read is the fail-soft half of the pair —
	 * `findOneOrFailByWhereOptions`, whose `ITryRequest` carries `success: false` — because the replay
	 * guard's whole question is whether this pair has been seen before, and "it has not" is the answer
	 * that lets the payload row be written.
	 *
	 * @param providerId The provider registration.
	 * @param eventId The provider's event identifier.
	 * @returns The event, or null when this pair has not been seen.
	 */
	async findByProviderAndEvent(providerId: ID, eventId: string): Promise<IPaymentWebhookEvent | null> {
		const outcome = await this.findOneOrFailByWhereOptions({
			providerId,
			eventId,
			...this.scope
		} as never);

		return outcome.success ? (outcome.record as IPaymentWebhookEvent) : null;
	}

	/**
	 * Paginates the callback log of the caller's organization.
	 *
	 * @param options Optional filters, merged with the tenancy scope.
	 * @returns One page of events.
	 */
	async findEvents(options: Record<string, unknown> = {}): Promise<IPagination<IPaymentWebhookEvent>> {
		return this.findAll({ ...options, where: { ...((options.where as object) ?? {}), ...this.scope } } as never);
	}

	/**
	 * Resolves the provider a callback names, by identifier or by code.
	 *
	 * @param input The callback being recorded.
	 * @returns The provider registration.
	 * @throws NotFoundException when no registration matches.
	 */
	private async resolveProvider(input: IPaymentWebhookIntakeInput): Promise<IPaymentProvider> {
		const provider = input.providerId
			? await this.paymentProviderService.findProviderOrNull(input.providerId)
			: input.providerCode
				? await this.paymentProviderService.findProviderByCode(input.providerCode)
				: null;

		if (!provider) {
			throw new NotFoundException('PAYMENT_WEBHOOK_UNKNOWN_PROVIDER');
		}

		return provider;
	}

	/**
	 * Applies the provider's own event map to a stored callback.
	 *
	 * The map is declared by the adapter in `payment_provider.configuration.eventMap`, so a provider
	 * that adds an event family does so by configuration rather than by a platform change. A type the
	 * map does not name is `IGNORED`: there is nothing to do, which is a different fact from a
	 * handler that broke.
	 *
	 * @param event The stored event.
	 * @param provider The provider registration the event belongs to.
	 * @returns The stored event.
	 */
	private async classify(
		event: IPaymentWebhookEvent,
		provider: IPaymentProvider
	): Promise<IPaymentWebhookEvent> {
		const handler = this.resolveHandler(provider, event.type);

		if (!handler) {
			return this.markIgnored(event.id);
		}

		// The handler named by the map applies the effect and settles the event through
		// `markProcessed` or `markFailed`; the intake leaves it queued rather than claiming an effect
		// it did not apply.
		return this.findEventOrFail(event.id);
	}

	/**
	 * Resolves the internal handler a provider's event type maps onto.
	 *
	 * @param provider The provider registration.
	 * @param type The provider's event type.
	 * @returns The handler name, or null when the map does not name the type.
	 */
	private resolveHandler(provider: IPaymentProvider, type: string): string | null {
		const eventMap = (provider.configuration?.eventMap ?? {}) as Record<string, unknown>;
		const handler = eventMap[type];

		return typeof handler === 'string' && handler.trim() ? handler : null;
	}

	/**
	 * Writes a settled status and stamps the instant it was settled at.
	 *
	 * @param id The stored event.
	 * @param status The status to write.
	 * @returns The stored event.
	 */
	private async settle(id: ID, status: PaymentWebhookEventStatus): Promise<IPaymentWebhookEvent> {
		await this.update(id, { status, processedAt: new Date(), lastError: null } as never);

		return this.findEventOrFail(id);
	}

	/**
	 * Refuses a payload that carries card data.
	 *
	 * @param payload The callback body.
	 * @throws BadRequestException naming the offending member.
	 */
	private assertNoCardData(payload: unknown): void {
		const member = findCardDataField(payload);

		if (member) {
			throw new BadRequestException(
				`PAYMENT_METHOD_CARD_DATA_NOT_ACCEPTED: card data is not accepted. The platform stores a provider-issued token only; the member '${member}' must be collected by the provider.`
			);
		}
	}
}
