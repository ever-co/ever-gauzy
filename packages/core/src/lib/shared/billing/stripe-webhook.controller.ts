import { Controller, ForbiddenException, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { IsNull } from 'typeorm';
import { Public } from '@gauzy/common';
import { RolesEnum } from '@gauzy/contracts';
import { TypeOrmTenantRepository } from '../../tenant/repository/type-orm-tenant.repository';
import { TypeOrmUserRepository } from '../../user/repository/type-orm-user.repository';
import {
	ProductScopedSubscription,
	checkoutSessionIsForProduct,
	describeProduct,
	resolveWebhookLinking,
	subscriptionIsForProduct
} from './billing-product';
import { StripeSubscriptionService, describeError } from './stripe-subscription.service';

/**
 * Stripe webhook receiver.
 *
 * The native billing pages read live from Stripe, so nothing here is needed to render them. What
 * this does is keep the tenant → customer link correct when a subscription is created or replaced
 * somewhere the platform never saw — through the Stripe customer portal, through the Dashboard, or
 * through a second checkout by the same person.
 *
 * Unsigned or unverifiable payloads are rejected. A webhook endpoint that trusts its body is an
 * unauthenticated write into the billing state of every tenant, so the signature check is not
 * optional and there is no bypass for local development.
 *
 * The endpoint is registered on a Stripe account that EVERY Ever product sells through, so most of
 * what arrives here is somebody else's: Teams, Platform, Rec, Works and directory-site purchases,
 * lifetime licenses, card saves, GitHands. Nothing is linked unless the event is provably a purchase
 * of this deployment's product (`BILLING_PRODUCT`), the matched user is an administrator of the
 * tenant it would link, and the customer holds an entitling subscription to that product. Every
 * linking-type event produces exactly one structured log line saying what was decided and why.
 *
 * Even then the tenant is only WRITTEN when `BILLING_WEBHOOK_LINKING` is on, which it is not by
 * default. All the webhook has to go on is the address typed at checkout, and a free Starter can be
 * started under anybody's address: a verified admin cannot be told apart from somebody buying in
 * their name. And for an existing admin who buys and then registers the NEW account the checkout
 * sends them to, the event lands a minute before that registration and would bind their OLD tenant,
 * leaving the tenant they paid for impossible to link. With the flag off the decision is logged as
 * `would-link` and the link is made by the buyer's own Checkout Session at onboarding, or by an
 * admin opening Settings > Billing.
 */
@ApiExcludeController()
@Controller('/billing/webhook')
export class StripeWebhookController {
	private readonly logger = new Logger(StripeWebhookController.name);

	constructor(
		private readonly stripeSubscriptionService: StripeSubscriptionService,
		private readonly typeOrmTenantRepository: TypeOrmTenantRepository,
		private readonly typeOrmUserRepository: TypeOrmUserRepository
	) {}

	@Public()
	@Post('/')
	@HttpCode(HttpStatus.OK)
	async handle(@Req() request: RawBodyRequest): Promise<{ received: true }> {
		const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

		// Absent secret means this deployment does not do billing. Refuse rather than silently accept:
		// an endpoint that returns 200 to anything is indistinguishable from one that works.
		if (!secret || !this.stripeSubscriptionService.isBillingEnforced()) {
			throw new ForbiddenException('Billing webhooks are not enabled on this deployment.');
		}

		const signature = request.headers['stripe-signature'];
		const payload = request.rawBody;

		if (typeof signature !== 'string' || !payload) {
			throw new ForbiddenException('Missing Stripe signature.');
		}
		if (!verifySignature(payload, signature, secret)) {
			throw new ForbiddenException('Invalid Stripe signature.');
		}

		let event: StripeEvent;
		try {
			event = JSON.parse(payload.toString('utf8'));
		} catch {
			throw new ForbiddenException('Malformed webhook payload.');
		}
		if (!event || typeof event !== 'object') {
			throw new ForbiddenException('Malformed webhook payload.');
		}

		// Always 200 once the signature is good — which means the handler's own failures must be
		// swallowed here, not propagated. Stripe retries on any non-2xx, so a bug in apply() would
		// otherwise turn into a retry storm, and a dropped event we can replay from the Dashboard is
		// the cheaper failure.
		try {
			await this.apply(event);
		} catch (error) {
			this.logger.error(`Failed to apply Stripe webhook ${event.type}; acknowledging anyway. ${describeError(error)}`);
		}

		return { received: true };
	}

	/**
	 * React to the handful of events that can change which customer a tenant bills through, and log
	 * exactly one decision line for each of them.
	 *
	 * Everything else — status transitions, invoice payments — is read live by the billing pages, so
	 * mirroring it into our database would only create a second copy to keep in sync.
	 */
	private async apply(event: StripeEvent): Promise<void> {
		if (!LINKING_EVENTS.has(event.type)) return;

		const object = event.data?.object ?? {};
		const outcome: LinkOutcome = { decision: 'error' };
		try {
			await this.decide(event.type, object, outcome);
		} catch (error) {
			outcome.decision = 'error';
			outcome.detail = describeError(error).slice(0, 200);
			throw error;
		} finally {
			this.logOutcome(event, object, outcome);
		}
	}

	/**
	 * Work out whether this event may link a tenant, and link it if so. Records the decision on
	 * `outcome` as it goes, so the caller can log it whatever path is taken — including a throw.
	 */
	private async decide(type: string, object: StripeEventObject, outcome: LinkOutcome): Promise<void> {
		const product = this.stripeSubscriptionService.billingProduct;

		// 1. Product allowlist, before ANY database or Stripe access. This endpoint receives every Ever
		//    product's events, and an allowlist is the only safe shape: Ever Works, GitHands and the
		//    directory sites never set `ever_product`, so a denylist of known products would let them
		//    all through.
		const ours =
			type === 'checkout.session.completed'
				? checkoutSessionIsForProduct(object, product)
				: subscriptionIsForProduct(object as ProductScopedSubscription, product);
		if (!ours) {
			outcome.decision = 'skipped-foreign';
			return;
		}

		// `customer` is an id string normally, but an expanded object when the event was created with
		// expansion — take the id either way rather than silently ignoring the expanded form.
		const customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id;
		outcome.customerId = customerId;
		if (!customerId) {
			outcome.decision = 'no-customer';
			return;
		}

		// Only `checkout.session.completed` carries the address inline. A Subscription object has no
		// email field at all, so reading it off the event alone would make `customer.subscription.created`
		// a permanent no-op — precisely the portal- and Dashboard-created subscriptions this receiver
		// exists to catch. Fall back to asking Stripe, on a short budget so the acknowledgement is not
		// held up by a slow Stripe.
		const email =
			object.customer_email ??
			object.customer_details?.email ??
			(await this.stripeSubscriptionService.getCustomerEmail(customerId, STRIPE_BUDGET_MS));
		if (!email) {
			outcome.decision = 'no-email';
			return;
		}

		// 2. Who owns this address. Tenant has no `users` relation, so the tenant is reached through the
		//    user rather than by joining from the other side.
		//
		// Deliberately not `.catch(() => null)`: a transient database error would then be
		// indistinguishable from "nobody has this address", and the event would be acknowledged as
		// handled when nothing happened. Letting it throw sends it to the handler above, which logs
		// it — and the event can still be replayed from the Stripe dashboard.
		const users: MatchedUser[] = await this.typeOrmUserRepository
			.createQueryBuilder('user')
			.leftJoin('user.role', 'role')
			.select(['user.id', 'user.tenantId', 'user.emailVerifiedAt', 'role.id', 'role.name'])
			.where('LOWER(user.email) = LOWER(:email)', { email: email.toLowerCase() })
			.andWhere('user.tenantId IS NOT NULL')
			.limit(2)
			.getMany();

		if (!users.length) {
			// The normal case for a new buyer: the event arrives a minute before they register. Their
			// tenant is linked at onboarding from the Checkout Session instead.
			outcome.decision = 'no-user';
			return;
		}

		// One address can exist in more than one tenant. Picking arbitrarily would attach a Stripe
		// customer to whichever row the database happened to return first, so this declines instead
		// and leaves the link to be made deliberately.
		if (users.length > 1) {
			outcome.decision = 'multi';
			return;
		}

		const user = users[0];
		outcome.tenantId = user?.tenantId ?? undefined;
		if (!user?.tenantId) {
			outcome.decision = 'no-user';
			return;
		}

		// 3. Only the tenant's administrators may bind it to a billing account. Accepting an invite
		//    verifies the invitee's address automatically, so without this an employee's, manager's or
		//    client contact's PERSONAL purchase — or a free Starter anyone can start under their
		//    address — would bind their EMPLOYER's tenant to that person's Stripe customer, and the
		//    employer's admins could then read, cancel and re-price it. The other two writers of this
		//    column (onboarding and the /billing lazy link) are admin-only already.
		if (!ADMIN_ROLES.has(user.role?.name ?? '')) {
			outcome.decision = 'non-admin';
			return;
		}

		// The address in this event is whatever the payer typed at checkout, and email is not unique in
		// this platform, so matching on it alone would let someone who registered under a paying
		// customer's address receive that customer's Stripe account. Requiring the matched user to have
		// confirmed the address closes that, on the same reasoning as the onboarding path — an attacker
		// can type a victim's address but cannot read their mail. An unverified match is left alone; the
		// link is made later, once the address is confirmed.
		if (!user.emailVerifiedAt) {
			outcome.decision = 'unverified';
			return;
		}

		// Never adopt a Stripe customer that another tenant already bills through. The write below
		// guards the *target* tenant from being repointed, but says nothing about the customer: two
		// tenants could end up sharing one billing account, and whichever opened /billing would be
		// looking at the other's invoices, card and subscription.
		const claimedBy = await this.typeOrmTenantRepository.findOne({
			where: { stripeCustomerId: customerId },
			select: { id: true }
		});
		if (claimedBy && claimedBy.id !== user.tenantId) {
			outcome.decision = 'claimed';
			outcome.detail = `held-by:${claimedBy.id}`;
			return;
		}

		// 4. Only a customer that actually holds an entitling subscription to this product. The event
		//    says a subscription was bought; this says it is still alive and still on our price.
		let entitled: boolean;
		try {
			entitled = await this.stripeSubscriptionService.customerHasEntitlingSubscription(customerId, STRIPE_BUDGET_MS);
		} catch (error) {
			outcome.decision = 'stripe-unavailable';
			outcome.detail = describeError(error).slice(0, 200);
			return;
		}
		if (!entitled) {
			outcome.decision = 'not-entitled';
			return;
		}

		// 5. Every check passed. Writing is a separate, default-off decision (see the class comment): the
		//    checks above cannot prove the purchase was the account owner's own.
		if (!resolveWebhookLinking()) {
			outcome.decision = 'would-link';
			return;
		}

		// Only fill a gap; never repoint a tenant that already has a customer. Overwriting that link
		// from a webhook would let a stray event move a tenant's billing onto another account.
		const updated = await this.typeOrmTenantRepository.update(
			{ id: user.tenantId, stripeCustomerId: IsNull() },
			{ stripeCustomerId: customerId }
		);
		outcome.decision = updated?.affected ? 'linked' : 'already-linked';
	}

	/**
	 * One line per linking-type event. Ids only — never the email address the decision was made on.
	 * Without this, "correctly ignored" and "never processed" look the same in the logs.
	 */
	private logOutcome(event: StripeEvent, object: StripeEventObject, outcome: LinkOutcome): void {
		const line = JSON.stringify({
			event: typeof event.id === 'string' ? event.id : undefined,
			type: event.type,
			product: this.stripeSubscriptionService.billingProduct,
			eventProduct: describeProduct(object),
			decision: outcome.decision,
			tenant: outcome.tenantId,
			customer: outcome.customerId,
			detail: outcome.detail
		});
		const message = `stripe-webhook ${line}`;
		if (WARN_DECISIONS.has(outcome.decision)) {
			this.logger.warn(message);
		} else {
			this.logger.log(message);
		}
	}
}

/** Events that can establish a tenant's billing customer for the first time. */
const LINKING_EVENTS = new Set(['checkout.session.completed', 'customer.subscription.created']);

/** Roles that may bind a tenant to a billing account — the same set the /billing routes allow. */
const ADMIN_ROLES = new Set<string>([RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN]);

/** Outcomes that deserve an operator's attention rather than being routine. */
const WARN_DECISIONS = new Set<LinkDecision>(['multi', 'claimed', 'stripe-unavailable', 'error']);

/**
 * Budget for each Stripe call made while Stripe is waiting for our acknowledgement. Short, so a slow
 * Stripe cannot push the response past Stripe's own delivery timeout and turn into a retry.
 */
const STRIPE_BUDGET_MS = 3000;

/**
 * What happened to one linking-type event.
 *
 * - `skipped-foreign`: another product's event (or payment/setup mode) — no DB or Stripe access.
 * - `no-customer` / `no-email`: nothing to match on.
 * - `no-user`: nobody has the address yet (the normal buy-then-register case).
 * - `multi`: the address exists in more than one tenant.
 * - `non-admin`: the one match is not SUPER_ADMIN/ADMIN of their tenant.
 * - `unverified`: the one match has not confirmed the address.
 * - `claimed`: another tenant already bills through this customer.
 * - `not-entitled`: the customer holds no active/trialing/past_due subscription to this product.
 * - `stripe-unavailable`: that could not be established; nothing was written.
 * - `would-link`: every check passed, but `BILLING_WEBHOOK_LINKING` is off, so nothing was written.
 * - `already-linked`: the tenant already had a customer; nothing was changed.
 * - `linked`: the tenant was linked.
 * - `error`: an unexpected failure (logged separately, still acknowledged).
 */
export type LinkDecision =
	| 'skipped-foreign'
	| 'no-customer'
	| 'no-email'
	| 'no-user'
	| 'multi'
	| 'non-admin'
	| 'unverified'
	| 'claimed'
	| 'not-entitled'
	| 'stripe-unavailable'
	| 'would-link'
	| 'already-linked'
	| 'linked'
	| 'error';

interface LinkOutcome {
	decision: LinkDecision;
	tenantId?: string;
	customerId?: string;
	detail?: string;
}

interface MatchedUser {
	id?: string;
	tenantId?: string | null;
	emailVerifiedAt?: Date | null;
	role?: { id?: string; name?: string } | null;
}

/**
 * Verify Stripe's `Stripe-Signature` header.
 *
 * Implemented directly rather than via the SDK so the platform gains no dependency for a feature
 * self-hosted installs never enable. The scheme is documented and small: `t=<unix>,v1=<hmac>`, where
 * the HMAC is SHA-256 over `<t>.<raw body>` keyed by the endpoint secret.
 */
function verifySignature(payload: Buffer, header: string, secret: string): boolean {
	const parts = header.split(',').reduce<Record<string, string[]>>((acc, part) => {
		const [key, value] = part.split('=', 2);
		if (key && value) (acc[key] ??= []).push(value);
		return acc;
	}, {});

	const timestamp = parts['t']?.[0];
	const signatures = parts['v1'] ?? [];
	if (!timestamp || !signatures.length) return false;

	// Reject anything older than five minutes so a captured request cannot be replayed later.
	const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
	if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

	const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(payload).digest('hex');

	// Stripe may send several signatures while a secret is being rotated; any one matching is enough.
	return signatures.some((candidate) => {
		const a = Buffer.from(candidate, 'utf8');
		const b = Buffer.from(expected, 'utf8');
		return a.length === b.length && timingSafeEqual(a, b);
	});
}

interface RawBodyRequest {
	headers: Record<string, string | string[] | undefined>;
	rawBody?: Buffer;
}

interface StripeEventObject {
	mode?: string | null;
	metadata?: Record<string, string> | null;
	customer?: string | { id?: string } | null;
	customer_email?: string | null;
	customer_details?: { email?: string | null } | null;
	items?: ProductScopedSubscription['items'];
}

interface StripeEvent {
	id?: string;
	type: string;
	data?: {
		object?: StripeEventObject;
	};
}
