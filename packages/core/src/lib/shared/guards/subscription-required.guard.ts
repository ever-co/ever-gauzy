import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { EntitlementResult, StripeSubscriptionService } from '../billing/stripe-subscription.service';

/**
 * Where someone is sent to buy a plan. Every Ever product shares one checkout, hosted on ever.co —
 * the platform never renders a payment form of its own.
 */
const CHECKOUT_URL = process.env.EVER_CHECKOUT_URL?.trim() || 'https://ever.co/checkout';

/**
 * A deliberately loose shape check — not validation.
 *
 * Its only job is to decide whether looking this string up in Stripe could possibly be meaningful.
 * Whether the address is acceptable is `CreateUserDTO`'s decision, and it makes it a moment later
 * with a far better message.
 */
function looksLikeEmail(value: string): boolean {
	const trimmed = value.trim();
	return trimmed.length > 2 && trimmed.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(trimmed);
}

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
 * Runs alongside RegisterAuthorizationGuard, which handles a different question (whether privileged
 * fields in the body are allowed). Neither subsumes the other.
 */
@Injectable()
export class SubscriptionRequiredGuard implements CanActivate {
	constructor(private readonly stripeSubscriptionService: StripeSubscriptionService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		// Self-hosted, or simply not configured for billing: nothing to enforce.
		if (!this.stripeSubscriptionService.isBillingEnforced()) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const email: unknown = request.body?.user?.email;

		// Anything that is not a plausible address is left to DTO validation. Guards run before
		// validation pipes in Nest, so without this check a typo like "alice@" would be looked up in
		// Stripe, found missing, and reported as "a subscription is required" — replacing a precise
		// validation message with a misleading one, and spending a Stripe call to do it.
		if (typeof email !== 'string' || !looksLikeEmail(email)) {
			return true;
		}

		// An admin creating a user inside an existing tenant is not a new subscriber, and must not be
		// forced through checkout. RegisterAuthorizationGuard has already authenticated this caller and
		// set request.user by the time this runs.
		if (request.user) {
			return true;
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
