import { RolesEnum } from '@gauzy/contracts';
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpStatus,
	NotFoundException,
	Post,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RequestContext } from '../../core/context';
import { TypeOrmTenantRepository } from '../../tenant/repository/type-orm-tenant.repository';
import { TenantService } from '../../tenant/tenant.service';
import { Roles } from '../decorators';
import { RoleGuard } from '../guards';
import {
	BillingInvoice,
	BillingPaymentMethod,
	BillingPlan,
	BillingService,
	BillingSubscription
} from './billing.service';

/**
 * In-product billing pages for the signed-in tenant.
 *
 * Two management paths are supported on purpose and both are meant to be good: these endpoints back
 * the native billing screens, and `POST /billing/portal` hands the user to Stripe's own customer
 * portal for anything the native screens do not cover.
 *
 * Two rules hold across every route here:
 *
 *  1. **The Stripe customer is resolved from the request's tenant, never from the request body.**
 *     Accepting a customer id from the client would let any signed-in user read or cancel another
 *     tenant's subscription — the single largest risk in this feature.
 *  2. **404 when billing is not configured.** A self-hosted install has no Stripe account, and the
 *     billing section should be absent rather than present-and-broken. The UI keys off
 *     `GET /billing/config`.
 */
@ApiTags('Billing')
@Controller('/billing')
export class BillingController {
	constructor(
		private readonly billingService: BillingService,
		private readonly typeOrmTenantRepository: TypeOrmTenantRepository,
		private readonly tenantService: TenantService
	) {}

	/**
	 * Whether this deployment does billing at all. Public to any signed-in user, because the UI has
	 * to decide whether to render a billing section before it knows anything else.
	 */
	@ApiOperation({ summary: 'Whether billing is configured on this deployment' })
	@ApiResponse({ status: HttpStatus.OK })
	@Get('/config')
	async config(): Promise<{ enabled: boolean; mode: 'live' | 'test' | 'disabled' }> {
		// `mode` is deliberately visible: a staging environment showing "test" is how an operator
		// confirms at a glance that it is not wired to the live Stripe account.
		return { enabled: this.billingService.isBillingEnforced(), mode: this.billingService.mode };
	}

	@ApiOperation({ summary: "The tenant's current subscription" })
	@ApiResponse({ status: HttpStatus.OK })
	@Get('/subscription')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async subscription(): Promise<BillingSubscription | null> {
		const customerId = await this.requireCustomerId();
		return this.billingService.getSubscription(customerId);
	}

	@ApiOperation({ summary: 'Plans this tenant can switch to' })
	@ApiResponse({ status: HttpStatus.OK })
	@Get('/plans')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async plans(): Promise<BillingPlan[]> {
		this.requireBillingEnabled();
		return this.billingService.listPlans(EVER_PRODUCT_KEY);
	}

	@ApiOperation({ summary: 'Switch the subscription to another plan' })
	@ApiResponse({ status: HttpStatus.OK })
	@Post('/subscription/change')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async changePlan(@Body() body: { lookupKey?: string }): Promise<BillingSubscription> {
		const customerId = await this.requireCustomerId();
		// 400, not 404: this controller uses 404 to mean "billing is not configured on this
		// deployment", and reusing it for a missing field would make the two indistinguishable.
		const lookupKey = body?.lookupKey?.trim();
		if (!lookupKey) {
			throw new BadRequestException('A plan must be supplied.');
		}
		return this.billingService.changePlan(customerId, lookupKey, EVER_PRODUCT_KEY);
	}

	@ApiOperation({ summary: 'Cancel at the end of the current period' })
	@ApiResponse({ status: HttpStatus.OK })
	@Post('/subscription/cancel')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async cancel(): Promise<BillingSubscription> {
		const customerId = await this.requireCustomerId();
		return this.billingService.cancelSubscription(customerId);
	}

	@ApiOperation({ summary: 'Undo a pending cancellation' })
	@ApiResponse({ status: HttpStatus.OK })
	@Post('/subscription/resume')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async resume(): Promise<BillingSubscription> {
		const customerId = await this.requireCustomerId();
		return this.billingService.resumeSubscription(customerId);
	}

	@ApiOperation({ summary: 'Invoice history' })
	@ApiResponse({ status: HttpStatus.OK })
	@Get('/invoices')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async invoices(): Promise<BillingInvoice[]> {
		const customerId = await this.requireCustomerId();
		return this.billingService.listInvoices(customerId);
	}

	@ApiOperation({ summary: 'The card on file' })
	@ApiResponse({ status: HttpStatus.OK })
	@Get('/payment-method')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async paymentMethod(): Promise<BillingPaymentMethod | null> {
		const customerId = await this.requireCustomerId();
		return this.billingService.getPaymentMethod(customerId);
	}

	/**
	 * Hand off to Stripe's customer portal — the second supported management path.
	 *
	 * `returnUrl` comes from the caller, so it is restricted to the deployment's own web app: an
	 * open redirect here would let a crafted link bounce a signed-in admin anywhere after a
	 * legitimate-looking Stripe visit.
	 */
	@ApiOperation({ summary: 'Open the Stripe customer portal' })
	@ApiResponse({ status: HttpStatus.CREATED })
	@Post('/portal')
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
	async portal(@Body() body: { returnUrl?: string }): Promise<{ url: string }> {
		const customerId = await this.requireCustomerId();
		const url = await this.billingService.createPortalSession(customerId, this.safeReturnUrl(body?.returnUrl));
		return { url };
	}

	/* ------------------------------------------------------------------ internals */

	private requireBillingEnabled(): void {
		if (!this.billingService.isBillingEnforced()) {
			// Not a 403: on a self-hosted install this feature genuinely does not exist.
			throw new NotFoundException('Billing is not available on this deployment.');
		}
	}

	/**
	 * The Stripe customer for the tenant making this request.
	 *
	 * Resolved from `RequestContext`, never from user input — see the class comment.
	 */
	private async requireCustomerId(): Promise<string> {
		this.requireBillingEnabled();

		const tenantId = RequestContext.currentTenantId();
		if (!tenantId) {
			throw new NotFoundException('No tenant in the current request.');
		}

		const tenant = await this.typeOrmTenantRepository.findOne({
			where: { id: tenantId },
			select: { id: true, stripeCustomerId: true }
		});

		const customerId = tenant?.stripeCustomerId?.trim();
		if (customerId) return customerId;

		// No link yet. That is the normal state for someone who has just bought: onboarding refuses to
		// make the link until the buyer has confirmed their email address, because an unconfirmed
		// address is not evidence of who they are. Once they have confirmed it, this resolves the link
		// on their first visit here.
		const linked = await this.tenantService.ensureStripeCustomerLink(tenantId, RequestContext.currentUserId());
		if (linked) return linked;

		throw new NotFoundException('This account is not linked to a billing customer.');
	}

	/**
	 * Only same-origin return URLs.
	 *
	 * There is no hardcoded fallback on purpose. Defaulting to `https://app.gauzy.co` would send a
	 * self-hosted operator's own users to a domain that operator does not control — so if
	 * `CLIENT_BASE_URL` is not configured, this refuses rather than guesses.
	 */
	private safeReturnUrl(candidate?: string): string {
		const base = (process.env.CLIENT_BASE_URL || '').trim();
		if (!base) {
			throw new BadRequestException(
				'CLIENT_BASE_URL is not configured, so there is no safe address to return you to after billing.'
			);
		}

		if (candidate) {
			try {
				const url = new URL(candidate);
				if (url.origin === new URL(base).origin) return url.toString();
			} catch {
				// Not a URL at all — fall through to the configured root.
			}
		}
		return base;
	}
}

/**
 * Which Ever product's plans this deployment offers. The catalog keys every price as
 * `ever_<product>_<hosting>_<tier>_<interval>`, and this platform is Gauzy.
 */
const EVER_PRODUCT_KEY = 'gauzy';
