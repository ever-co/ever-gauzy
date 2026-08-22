import { Controller, ForbiddenException, HttpCode, HttpStatus, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { createHmac, timingSafeEqual } from 'crypto';
import { IsNull } from 'typeorm';
import { Public } from '@gauzy/common';
import { TypeOrmTenantRepository } from '../../tenant/repository/type-orm-tenant.repository';
import { TypeOrmUserRepository } from '../../user/repository/type-orm-user.repository';
import { StripeSubscriptionService } from './stripe-subscription.service';

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

		await this.apply(event);

		// Always 200 once the signature is good. Stripe retries on any other status, and a retry
		// storm caused by our own bug is worse than a dropped event we can replay from the Dashboard.
		return { received: true };
	}

	/**
	 * React to the handful of events that can change which customer a tenant bills through.
	 *
	 * Everything else — status transitions, invoice payments — is read live by the billing pages, so
	 * mirroring it into our database would only create a second copy to keep in sync.
	 */
	private async apply(event: StripeEvent): Promise<void> {
		if (!LINKING_EVENTS.has(event.type)) return;

		const object = event.data?.object ?? {};
		const customerId = typeof object.customer === 'string' ? object.customer : undefined;
		const email = object.customer_email ?? object.customer_details?.email;

		if (!customerId || !email) return;

		// Tenant has no `users` relation, so the tenant is reached through the user that owns the
		// email rather than by joining from the other side.
		const user = await this.typeOrmUserRepository
			.createQueryBuilder('user')
			.select(['user.id', 'user.tenantId'])
			.where('LOWER(user.email) = LOWER(:email)', { email })
			.andWhere('user.tenantId IS NOT NULL')
			.getOne()
			.catch(() => null);

		if (!user?.tenantId) return;

		// Only fill a gap; never repoint a tenant that already has a customer. Overwriting that link
		// from a webhook would let a stray event move a tenant's billing onto another account.
		const updated = await this.typeOrmTenantRepository.update(
			{ id: user.tenantId, stripeCustomerId: IsNull() },
			{ stripeCustomerId: customerId }
		);

		if (updated.affected) {
			this.logger.log(`Linked tenant ${user.tenantId} to Stripe customer ${customerId} from ${event.type}.`);
		}
	}
}

/** Events that can establish a tenant's billing customer for the first time. */
const LINKING_EVENTS = new Set(['checkout.session.completed', 'customer.subscription.created']);

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

interface StripeEvent {
	type: string;
	data?: {
		object?: {
			customer?: string | { id?: string };
			customer_email?: string;
			customer_details?: { email?: string };
		};
	};
}
