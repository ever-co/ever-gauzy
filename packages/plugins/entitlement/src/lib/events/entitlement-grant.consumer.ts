import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import {
	EventConsumerKind,
	EventConsumerOrdering,
	ID,
	IEventConsumer,
	IEventConsumerContext,
	IEventEnvelope
} from '@gauzy/contracts';
import { EventConsumerRegistry } from '@gauzy/core';
import { EntitlementKind } from '../entitlement.enums';
import {
	ENTITLEMENT_CONSUMED_EVENTS,
	ENTITLEMENT_ORDER_STATE_PORT,
	EntitlementRevocationReason,
	EntitlementSuspensionReason,
	IEntitlementOrderStatePort,
	IEntitlementScope
} from '../entitlement.types';
import { Entitlement } from '../entitlement/entitlement.entity';
import { EntitlementService } from '../entitlement/entitlement.service';
import { activatableOrderLines, orderWithdrawalReason } from './entitlement-order-settlement';

/**
 * The shape a granting order line carries.
 *
 * The order capability publishes a projection of its lines, and a line that grants a right says so
 * in `entitlement`: what kind of right it is, how many of it, over what term and under what
 * activation ceiling. A line without that member grants nothing, which is how a tenant sells a
 * mixture of ordinary goods and licensed ones in one order.
 */
export interface IOrderLineEntitlementPolicy {
	readonly kind?: EntitlementKind;
	readonly quantity?: number;
	readonly endsAt?: string | Date;
	readonly startsAt?: string | Date;
	readonly gracePeriodDays?: number;
	readonly activationLimit?: number;
	readonly metadata?: Record<string, unknown>;
}

/** One line of an order, as the order capability projects it into its events. */
export interface IOrderLineProjection {
	readonly id?: ID;
	readonly orderLineId?: ID;
	readonly lineId?: ID;
	readonly productId?: ID;
	readonly variantId?: ID;
	readonly quantity?: number;
	readonly entitlement?: IOrderLineEntitlementPolicy;
}

/** One line of a refund, when the payment capability says which lines were refunded. */
export interface IRefundLineProjection {
	readonly orderLineId?: ID;
	readonly quantity?: number;
	/** True when the whole line was refunded, which revokes the right the line granted. */
	readonly full?: boolean;
}

/**
 * The grant path: what turns a purchase into a right.
 *
 * The consumer is registered with the platform's consumer registry by event **name**, which is the
 * whole reason this package can act on another domain's facts without importing its classes and
 * without reading its tables. What it needs arrives in the payload; when a payload does not carry
 * enough to decide, the fact is reported and skipped rather than looked up, because a guess about
 * what a refund covered is worse than a report that a refund could not be applied.
 *
 * Delivery is at-least-once, and every handler here is idempotent on purpose: the grant is keyed by
 * its provenance, activating a right that is already in force is a no-op, and the transitions a
 * replay would repeat are the ones that check the state they move away from.
 *
 * Delivery is also reorderable, so a retried `order.placed` can arrive after the `order.completed` it
 * preceded, when there was nothing yet to put into force, or after the cancellation or the full refund
 * that had nothing yet to withdraw. Where the deployment binds {@link ENTITLEMENT_ORDER_STATE_PORT}, the
 * placement asks the order capability where the order is now (#11023): it grants nothing for an order
 * already withdrawn, and it puts into force what it granted for lines that are still paid for on an order
 * that settled since. The order and line rows are the durable record of both, and they are read through
 * the port the order capability provides, never from its tables. Without the port the rights stay
 * `PENDING` until the next settlement event, as before.
 */
@Injectable()
export class EntitlementGrantConsumer implements IEventConsumer, OnModuleInit {
	/** This consumer's key, without its kind prefix. */
	readonly key = 'entitlement-provisioning';

	/** In process, so the delivery record is `subscriber:entitlement-provisioning`. */
	readonly kind = EventConsumerKind.SUBSCRIBER;

	/**
	 * Reorderable: the handlers are idempotent on the state they read, so one slow event must not hold
	 * the head of a partition for every other consumer of that aggregate.
	 */
	readonly ordering = EventConsumerOrdering.REORDERABLE;

	/** Attempts before the delivery is dead-lettered. */
	readonly maxAttempts = 8;

	/** The events this consumer wants, matched exactly. */
	readonly events = ENTITLEMENT_CONSUMED_EVENTS;

	private readonly logger = new Logger(EntitlementGrantConsumer.name);

	constructor(
		private readonly entitlementService: EntitlementService,
		@Optional() private readonly registry?: EventConsumerRegistry,
		@Optional()
		@Inject(ENTITLEMENT_ORDER_STATE_PORT)
		private readonly orderState?: IEntitlementOrderStatePort
	) {}

	/**
	 * Registers with the dispatcher, when the outbox runtime is part of this deployment.
	 */
	onModuleInit(): void {
		this.register();
	}

	/**
	 * Registers this consumer.
	 *
	 * @returns True when it was registered; false when the deployment has no dispatcher, in which case
	 * the grants are still made by the operator paths and simply not by events.
	 */
	register(): boolean {
		if (!this.registry) {
			return false;
		}

		this.registry.register(this);

		return true;
	}

	/**
	 * Applies one order, payment or subscription event to this domain's state.
	 *
	 * @param event The event envelope.
	 * @param context The delivery context.
	 */
	async handle(event: IEventEnvelope, context: IEventConsumerContext): Promise<void> {
		await context.assertOrder(event);

		if (await context.alreadyDelivered()) {
			return;
		}

		const scope: IEntitlementScope = {
			tenantId: event.tenantId,
			organizationId: event.organizationId
		};

		switch (event.name) {
			case 'order.placed':
				await this.onOrderPlaced(event, scope);
				return;
			case 'payment.captured':
			case 'order.completed':
				await this.onOrderSettled(event, scope);
				return;
			case 'order.canceled':
				await this.onOrderCanceled(event, scope);
				return;
			case 'payment.refunded':
				await this.onPaymentRefunded(event, scope);
				return;
			case 'subscription.activated':
				await this.onSubscriptionActivated(event, scope);
				return;
			case 'subscription.renewed':
				await this.onSubscriptionRenewed(event, scope);
				return;
			case 'subscription.payment-failed':
				await this.onSubscriptionPaymentFailed(event, scope);
				return;
			case 'subscription.canceled':
				await this.onSubscriptionCanceled(event, scope);
				return;
			case 'subscription.expired':
				await this.onSubscriptionExpired(event, scope);
				return;
			default:
				// An event this consumer asked for but does not handle is a declaration mistake, and a
				// silent no-op would hide it.
				throw new Error(`The entitlement consumer received "${event.name}", which it does not handle.`);
		}
	}

	/**
	 * Grants a `PENDING` right for every line of a placed order that carries an entitlement policy.
	 *
	 * The right is not yet in force: it is granted by the purchase and becomes exercisable when the
	 * money settles, which is normally the next event. A placement delivered after the order's later events
	 * reads where the order is now instead: it grants nothing for an order that was cancelled or refunded in
	 * full in the meantime (see {@link isWithdrawnBeforePlacement}), and it puts into force what it granted when
	 * the order settled in the meantime (see {@link reconcileWithOrderState}).
	 *
	 * @param event The `order.placed` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onOrderPlaced(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const orderId = data.orderId ?? event.aggregate?.id;
		const lines: IOrderLineProjection[] = Array.isArray(data.lines) ? data.lines : [];

		if (!orderId || !lines.length) {
			this.logger.warn(`order.placed ${event.id} carries no order or no lines, so nothing was granted.`);
			return;
		}

		const granting = lines.filter(
			(line): line is IOrderLineProjection & { entitlement: IOrderLineEntitlementPolicy } => !!line.entitlement
		);

		if (!granting.length || (await this.isWithdrawnBeforePlacement(orderId, event, scope))) {
			return;
		}

		const orderLineIds: ID[] = [];

		for (const line of granting) {
			const policy = line.entitlement;
			const orderLineId = line.orderLineId ?? line.lineId ?? line.id;

			await this.entitlementService.grant(
				{
					customerId: data.customerId,
					orderId,
					orderLineId,
					productId: line.productId,
					variantId: line.variantId,
					kind: policy.kind ?? EntitlementKind.LICENCE,
					quantity: policy.quantity ?? Number(line.quantity ?? 1),
					startsAt: policy.startsAt ? new Date(policy.startsAt) : new Date(),
					endsAt: policy.endsAt ? new Date(policy.endsAt) : undefined,
					gracePeriodDays: policy.gracePeriodDays,
					activationLimit: policy.activationLimit,
					metadata: policy.metadata
				},
				scope
			);

			if (orderLineId) {
				orderLineIds.push(orderLineId);
			}
		}

		await this.reconcileWithOrderState(orderId, orderLineIds, event, scope);
	}

	/**
	 * Whether the order a placement is about to grant from was cancelled or refunded in full before the
	 * placement was delivered.
	 *
	 * The `order.canceled` or the full `payment.refunded` handled first found nothing to withdraw, and nothing
	 * after it will withdraw what a late placement grants, so the placement grants nothing and says so. Without
	 * the port, or for an order the port does not find, the placement grants as it always did.
	 *
	 * @param orderId The order the placement grants from.
	 * @param event The `order.placed` event, for the log.
	 * @param scope The tenant and organization the event belongs to.
	 * @returns True when nothing should be granted.
	 */
	private async isWithdrawnBeforePlacement(
		orderId: ID,
		event: IEventEnvelope,
		scope: IEntitlementScope
	): Promise<boolean> {
		if (!this.orderState) {
			return false;
		}

		const reason = orderWithdrawalReason(await this.orderState.findState(orderId, scope));

		if (!reason) {
			return false;
		}

		this.logger.warn(
			`order.placed ${event.id} was delivered after order ${orderId} was withdrawn (${reason}), so no entitlement was granted.`
		);

		return true;
	}

	/**
	 * Brings the rights a placement just granted in line with where the order is now.
	 *
	 * The consumer is reorderable, so `order.completed` (or `payment.captured`) can be handled before a
	 * retried `order.placed`: it then finds nothing `PENDING` to activate, and without this the rights the
	 * placement grants afterwards would wait for a settlement event that has already come and gone. The
	 * order's own state is the durable memo of that settlement — `COMPLETED` is written in the transaction
	 * that appends `order.completed` — so it is asked here, after the grants, and the activation the
	 * settlement handler performs is repeated, line by line: only the lines that are still paid for are put
	 * into force ({@link activatableOrderLines}), so a refund handled before the placement does not leave the
	 * line it refunded with a right in force. A line left out keeps its right `PENDING`.
	 *
	 * Asking after the grants is what closes the race with a concurrent cancellation as well: when the order
	 * reads cancelled or refunded in full now, its `order.canceled` or `payment.refunded` may already have
	 * found nothing to withdraw, so what the order granted is withdrawn here, with the reason that event gives.
	 *
	 * Every step is idempotent, so a replay of any of the events changes nothing. A read that fails is not
	 * swallowed: the delivery is retried, and the grants it repeats are replays.
	 *
	 * @param orderId The order the placement granted from.
	 * @param orderLineIds The lines the placement granted rights for.
	 * @param event The `order.placed` event, for the log.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async reconcileWithOrderState(
		orderId: ID,
		orderLineIds: readonly ID[],
		event: IEventEnvelope,
		scope: IEntitlementScope
	): Promise<void> {
		if (!this.orderState) {
			return;
		}

		const state = await this.orderState.findState(orderId, scope);
		const reason = orderWithdrawalReason(state);

		if (reason) {
			this.logger.warn(
				`order.placed ${event.id} granted while order ${orderId} was being withdrawn (${reason}), so its entitlements were withdrawn again.`
			);

			await this.withdrawOrder(orderId, reason, scope);
			return;
		}

		const activatable = activatableOrderLines(state, orderLineIds);

		if (!activatable.length) {
			return;
		}

		this.logger.log(
			`order.placed ${event.id} was delivered after order ${orderId} settled, so the entitlements of ${activatable.length} of its ${orderLineIds.length} granting line(s) were put into force on placement.`
		);

		for (const orderLineId of activatable) {
			await this.entitlementService.activateGranted({ orderId, orderLineId }, scope);
		}
	}

	/**
	 * Puts the rights an order granted into force, because its money settled.
	 *
	 * @param event The `payment.captured` or `order.completed` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onOrderSettled(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const orderId = data.orderId ?? event.aggregate?.id;

		if (!orderId) {
			this.logger.warn(`${event.name} ${event.id} carries no order, so no entitlement could be put into force.`);
			return;
		}

		await this.entitlementService.activateGranted({ orderId }, scope);
	}

	/**
	 * Withdraws the rights an order granted, because the order was cancelled before it was paid for.
	 *
	 * @param event The `order.canceled` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onOrderCanceled(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const orderId = data.orderId ?? event.aggregate?.id;

		if (!orderId) {
			return;
		}

		await this.withdrawOrder(orderId, EntitlementRevocationReason.ORDER_CANCELED, scope);
	}

	/**
	 * Applies a refund to the rights the refunded lines granted.
	 *
	 * A partial refund lowers the ceiling by what was refunded; a full one withdraws the right the
	 * line granted. Both are statements about money, which is why the lifetime of a right follows the
	 * refund and not the parcel that came back.
	 *
	 * The payload must name the lines and what happened to each. When it does not, the refund is
	 * reported and skipped: revoking a right because a payment event omitted its detail would
	 * withdraw something the customer paid for, and no amount of tidiness is worth that.
	 *
	 * @param event The `payment.refunded` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onPaymentRefunded(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const orderId = data.orderId;
		const lines: IRefundLineProjection[] = Array.isArray(data.lines) ? data.lines : [];

		if (!orderId) {
			return;
		}

		if (!lines.length) {
			if (data.fullRefund === true || data.full === true) {
				await this.withdrawOrder(orderId, EntitlementRevocationReason.REFUNDED, scope);
				return;
			}

			this.logger.warn(
				`payment.refunded ${event.id} names no refunded lines, so the entitlements of order ${orderId} were left as they are.`
			);
			return;
		}

		for (const line of lines) {
			if (!line.orderLineId) {
				continue;
			}

			const entitlements = await this.findByOrderLine(line.orderLineId, scope);

			for (const entitlement of entitlements) {
				if (line.full === true || line.quantity === undefined) {
					await this.entitlementService.revoke(
						entitlement.id,
						EntitlementRevocationReason.REFUNDED,
						scope
					);
					continue;
				}

				const remaining = Math.max(0, Number(entitlement.quantity) - Number(line.quantity));

				await this.entitlementService.reduce(entitlement.id, remaining, 'REFUNDED', scope);
			}
		}
	}

	/**
	 * Puts the rights a subscription carries into force on its first successful billing cycle.
	 *
	 * @param event The `subscription.activated` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onSubscriptionActivated(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const subscriptionId = data.subscriptionId ?? event.aggregate?.id;

		if (!subscriptionId) {
			return;
		}

		await this.entitlementService.activateGranted({ subscriptionId }, scope);
	}

	/**
	 * Extends the term of every right a subscription keeps alive.
	 *
	 * Renewal is not a second mechanism: the same rows are extended by exactly one billed period, and
	 * a right that was suspended by dunning returns to force.
	 *
	 * @param event The `subscription.renewed` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onSubscriptionRenewed(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const subscriptionId = data.subscriptionId ?? event.aggregate?.id;
		const periodEnd = data.periodEnd ?? data.currentPeriodEnd ?? data.endsAt;

		if (!subscriptionId || !periodEnd) {
			this.logger.warn(`subscription.renewed ${event.id} carries no period end, so no entitlement was extended.`);
			return;
		}

		const entitlements = await this.findBySubscription(subscriptionId, scope);

		for (const entitlement of entitlements) {
			await this.entitlementService.extend(
				entitlement.id,
				{
					endsAt: new Date(periodEnd),
					quantity: entitlement.quantity,
					note: 'SUBSCRIPTION_RENEWED'
				},
				scope
			);
		}
	}

	/**
	 * Suspends the rights a subscription keeps alive, because its payment failed.
	 *
	 * Nothing is withdrawn at this point: the term has not run out, the grace period is what expresses
	 * "still in force while a renewal is chased", and a customer whose card expired must not lose
	 * their seats over it.
	 *
	 * @param event The `subscription.payment-failed` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onSubscriptionPaymentFailed(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const subscriptionId = data.subscriptionId ?? event.aggregate?.id;

		if (!subscriptionId) {
			return;
		}

		for (const entitlement of await this.findBySubscription(subscriptionId, scope)) {
			await this.entitlementService.suspend(entitlement.id, EntitlementSuspensionReason.PAYMENT_FAILED, scope);
		}
	}

	/**
	 * Ends the rights a cancelled subscription carried.
	 *
	 * A subscription cancelled with immediate effect (`immediate: true`) is `CANCELED` from that
	 * instant, and its rights are withdrawn with it. One cancelled at the end of a paid period
	 * (`immediate: false`) leaves them alone, because the customer has paid for the period they are in;
	 * when that period runs out, the billing run cancels it with immediate effect, and that event is
	 * the one that withdraws them.
	 *
	 * `immediate` is the field `SubscriptionService.cancel` states. This handler also required a
	 * `noProrationCredit` flag, which no producer has ever stated, so it returned early on every
	 * cancellation and a cancelled subscriber kept every right. Whether a credit is given back
	 * does not change the answer: the subscription has ended either way.
	 *
	 * @param event The `subscription.canceled` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onSubscriptionCanceled(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const subscriptionId = data.subscriptionId ?? event.aggregate?.id;

		if (!subscriptionId) {
			return;
		}

		if (data.immediate !== true) {
			// The subscription runs to the end of the period it paid for, and so do its rights.
			return;
		}

		for (const entitlement of await this.findBySubscription(subscriptionId, scope)) {
			await this.entitlementService.revoke(
				entitlement.id,
				EntitlementRevocationReason.SUBSCRIPTION_ENDED,
				scope
			);
		}
	}

	/**
	 * Expires the rights a lapsed subscription carried.
	 *
	 * @param event The `subscription.expired` event.
	 * @param scope The tenant and organization the event belongs to.
	 */
	private async onSubscriptionExpired(event: IEventEnvelope, scope: IEntitlementScope): Promise<void> {
		const data = (event.data ?? {}) as Record<string, any>;
		const subscriptionId = data.subscriptionId ?? event.aggregate?.id;

		if (!subscriptionId) {
			return;
		}

		for (const entitlement of await this.findBySubscription(subscriptionId, scope)) {
			await this.entitlementService.expire(entitlement.id, data.reason ?? 'SUBSCRIPTION_EXPIRED', scope);
		}
	}

	/**
	 * Withdraws every right an order granted, as a cancellation or a full refund does.
	 *
	 * @param orderId The order.
	 * @param reason The revocation reason.
	 * @param scope The tenant and organization.
	 */
	private async withdrawOrder(orderId: ID, reason: string, scope: IEntitlementScope): Promise<void> {
		for (const entitlement of await this.findByOrder(orderId, scope)) {
			await this.entitlementService.revoke(entitlement.id, reason, scope);
		}
	}

	/**
	 * @param orderId The order.
	 * @param scope The tenant and organization.
	 * @returns The rights the order granted.
	 */
	private async findByOrder(orderId: ID, scope: IEntitlementScope): Promise<Entitlement[]> {
		return await this.entitlementService.find({
			where: {
				orderId,
				...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
				...(scope.organizationId ? { organizationId: scope.organizationId } : {})
			} as any
		});
	}

	/**
	 * @param orderLineId The granting line.
	 * @param scope The tenant and organization.
	 * @returns The rights the line granted.
	 */
	private async findByOrderLine(orderLineId: ID, scope: IEntitlementScope): Promise<Entitlement[]> {
		return await this.entitlementService.find({
			where: {
				orderLineId,
				...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
				...(scope.organizationId ? { organizationId: scope.organizationId } : {})
			} as any
		});
	}

	/**
	 * @param subscriptionId The subscription.
	 * @param scope The tenant and organization.
	 * @returns The rights the subscription keeps alive.
	 */
	private async findBySubscription(subscriptionId: ID, scope: IEntitlementScope): Promise<Entitlement[]> {
		return await this.entitlementService.find({
			where: {
				subscriptionId,
				...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
				...(scope.organizationId ? { organizationId: scope.organizationId } : {})
			} as any
		});
	}
}
