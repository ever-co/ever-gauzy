import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { isCheckoutSessionId } from '../billing/billing-product';
import { EntitlementResult, StripeSubscriptionService } from '../billing/stripe-subscription.service';

/**
 * Where someone is sent to buy a plan. Every Ever product shares one checkout, hosted on ever.co —
 * the platform never renders a payment form of its own.
 */
const CHECKOUT_URL = process.env.EVER_CHECKOUT_URL?.trim() || 'https://ever.co/checkout';

/**
 * Requires the registering email to hold a Stripe subscription.
 *
 * This exists because signup on the hosted deployments now begins at checkout: the visitor picks a
 * plan, Stripe captures a card, and only then are they returned to the register form. Someone who
 * arrives at `/auth/register` directly has skipped that, so they are sent to checkout instead.
 *
 * **Inert unless STRIPE_SECRET_KEY is set.** That is the whole contract for self-hosters: clone the
 * repo, set no Stripe key, and registration behaves exactly as it always has — no Stripe call is
 * made, no subscription is required, and this guard returns true before doing anything else.
 *
 * **Also inert when `BILLING_SIGNUP_PAYWALL=false`.** A deployment can bill (link tenants, show the
 * billing pages) without requiring a subscription to sign up — Ever Teams does exactly that.
 *
 * Only a subscription to THIS deployment's product (`BILLING_PRODUCT`, default `gauzy`) counts:
 * the Stripe account is shared by every Ever product, and a free Teams or Platform Starter must not
 * open Gauzy signup.
 *
 * Runs alongside RegisterAuthorizationGuard, which handles a different question (whether privileged
 * fields in the body are allowed). Neither subsumes the other.
 */
@Injectable()
export class SubscriptionRequiredGuard implements CanActivate {
	private readonly logger = new Logger(SubscriptionRequiredGuard.name);

	constructor(private readonly stripeSubscriptionService: StripeSubscriptionService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Self-hosted, not configured for billing, or billing without a signup paywall: nothing to enforce.
		if (!this.stripeSubscriptionService.isSignupPaywallEnabled()) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const email: unknown = request.body?.user?.email;

		// Only a missing or non-string value is waved through, and only because there is then nothing
		// to look up — `CreateUserDTO` rejects it a moment later, so no account can result.
		//
		// This deliberately does NOT screen the value against an "is it plausibly an address" pattern
		// first. A previous version did, and returned true when the pattern failed, which turned any
		// disagreement between that pattern and `@IsEmail()` into a way past the paywall: a quoted
		// local part such as `"john doe"@example.com` is rejected by a naive pattern and accepted by
		// the validator, so it skipped the entitlement check entirely and registered for free. A gate
		// must not be more permissive than the validator standing behind it, and the only way to
		// guarantee that is to not second-guess it.
		//
		// The cost is that a typo like "alice@" now spends one Stripe lookup and is reported as
		// needing a subscription rather than as malformed. A slightly worse message on a typo is a
		// fair price for a paywall that cannot be stepped around.
		if (typeof email !== 'string' || !email.trim()) {
			return true;
		}

		// An admin creating a user inside an existing tenant is not a new subscriber, and must not be
		// forced through checkout. RegisterAuthorizationGuard has already authenticated this caller and
		// set request.user by the time this runs.
		if (request.user) {
			return true;
		}

		// The buyer's own Checkout Session, forwarded by the checkout's completion page, is the most
		// direct proof there is: Stripe says this address completed a purchase of this product. Guards
		// run before the validation pipe, so the raw body value is shape-checked here. A session that
		// does not verify is not an error — the address is simply looked up the ordinary way below.
		const sessionId: unknown = request.body?.stripeCheckoutSessionId;
		if (isCheckoutSessionId(sessionId)) {
			const verification = await this.stripeSubscriptionService.verifyCheckoutSession(sessionId, email);
			if (verification.ok === false) {
				this.logger.log(`Checkout Session not accepted as registration proof (${verification.reason}).`);
			} else {
				return true;
			}
		}

		const entitlement = await this.stripeSubscriptionService.getEntitlement(email);

		// UNKNOWN means Stripe could not answer. Let it through — see getEntitlement() for why an
		// outage must not take signup down with it.
		if (entitlement === EntitlementResult.NOT_ENTITLED) {
			throw new ForbiddenException({
				message:
					'A subscription is required before you can create an account. ' +
					'Choose a plan to start your free trial, then finish signing up.',
				checkoutUrl: `${CHECKOUT_URL}?email=${encodeURIComponent(email.trim())}`
			});
		}

		return true;
	}
}
