/**
 * 🛑 This import must stay FIRST — the controller imports repositories and TenantService.
 */
import '../../core/entities/internal';
import { HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { RequestContext } from '../../core/context';
import { BillingController } from './billing.controller';
import { PaymentMethodRequiredError } from './billing.service';

/**
 * Two controller-level rules added with the product scoping:
 *
 *  - a tenant whose stored link points at a customer who never subscribed to THIS product is treated
 *    as not linked (404), so no route shows or acts on another product's (another person's) billing;
 *  - an upgrade refused for want of a card answers 402 `payment_method_required` with a Stripe portal
 *    link the web app sends the admin to — never a silent past_due subscription.
 */

const TENANT_ID = '11111111-1111-4111-8111-111111111111';

function build(options: { isCustomerOfProduct: boolean; changePlan?: jest.Mock; portal?: jest.Mock }) {
	const billingService: any = {
		isBillingEnforced: () => true,
		product: 'gauzy',
		isCustomerOfProduct: jest.fn(async () => options.isCustomerOfProduct),
		getSubscription: jest.fn(async () => ({ id: 'sub_g' })),
		listInvoices: jest.fn(async () => []),
		getPaymentMethod: jest.fn(async () => null),
		createPortalSession: options.portal ?? jest.fn(async () => 'https://billing.stripe.test/session/abc'),
		changePlan: options.changePlan ?? jest.fn(async () => ({ id: 'sub_g' }))
	};
	const tenantRepository: any = { findOne: jest.fn(async () => ({ id: TENANT_ID, stripeCustomerId: 'cus_1' })) };
	const tenantService: any = { ensureStripeCustomerLink: jest.fn(async () => null) };
	return { controller: new BillingController(billingService, tenantRepository, tenantService), billingService };
}

const savedBase = process.env.CLIENT_BASE_URL;

beforeEach(() => {
	process.env.CLIENT_BASE_URL = 'https://app.gauzy.test';
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	if (savedBase === undefined) delete process.env.CLIENT_BASE_URL;
	else process.env.CLIENT_BASE_URL = savedBase;
	jest.restoreAllMocks();
});

describe("BillingController — a link to another product's customer is no link", () => {
	it.each([
		['subscription', (c: BillingController) => c.subscription()],
		['invoices', (c: BillingController) => c.invoices()],
		['payment method', (c: BillingController) => c.paymentMethod()],
		['cancel', (c: BillingController) => c.cancel()],
		['portal', (c: BillingController) => c.portal({ returnUrl: 'https://app.gauzy.test/#/pages/settings/billing' })]
	])('%s answers 404 and never reaches Stripe on that customer', async (_label, call) => {
		const { controller, billingService } = build({ isCustomerOfProduct: false });
		await expect(call(controller)).rejects.toBeInstanceOf(NotFoundException);
		expect(billingService.getSubscription).not.toHaveBeenCalled();
		expect(billingService.listInvoices).not.toHaveBeenCalled();
		expect(billingService.getPaymentMethod).not.toHaveBeenCalled();
		expect(billingService.createPortalSession).not.toHaveBeenCalled();
	});

	it('a customer of this product is served as before', async () => {
		const { controller } = build({ isCustomerOfProduct: true });
		await expect(controller.subscription()).resolves.toEqual({ id: 'sub_g' });
	});
});

describe('BillingController.changePlan — CC02-13', () => {
	it('answers 402 payment_method_required with a portal link that returns to the page', async () => {
		const portal = jest.fn(async () => 'https://billing.stripe.test/session/abc');
		const { controller } = build({
			isCustomerOfProduct: true,
			portal,
			changePlan: jest.fn(async () => {
				throw new PaymentMethodRequiredError();
			})
		});

		const error: HttpException = await controller
			.changePlan({
				lookupKey: 'ever_gauzy_cloud_small_business_annual',
				returnUrl: 'https://app.gauzy.test/#/pages/settings/billing'
			})
			.then(
				() => null,
				(e) => e
			);

		expect(error).toBeInstanceOf(HttpException);
		expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
		expect(error.getResponse()).toMatchObject({
			code: 'payment_method_required',
			portalUrl: 'https://billing.stripe.test/session/abc'
		});
		expect(portal).toHaveBeenCalledWith('cus_1', 'https://app.gauzy.test/#/pages/settings/billing');
	});

	it('never hands the portal a foreign return URL', async () => {
		const portal = jest.fn(async () => 'https://billing.stripe.test/session/abc');
		const { controller } = build({
			isCustomerOfProduct: true,
			portal,
			changePlan: jest.fn(async () => {
				throw new PaymentMethodRequiredError();
			})
		});
		await controller
			.changePlan({ lookupKey: 'ever_gauzy_x', returnUrl: 'https://evil.test/' })
			.catch(() => undefined);
		expect(portal).toHaveBeenCalledWith('cus_1', 'https://app.gauzy.test');
	});

	it('still answers 402 (without a link) if the portal cannot be opened', async () => {
		const { controller } = build({
			isCustomerOfProduct: true,
			portal: jest.fn(async () => {
				throw new Error('portal down');
			}),
			changePlan: jest.fn(async () => {
				throw new PaymentMethodRequiredError();
			})
		});
		const error: HttpException = await controller.changePlan({ lookupKey: 'ever_gauzy_x' }).then(
			() => null,
			(e) => e
		);
		expect(error.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
		expect(error.getResponse()).not.toHaveProperty('portalUrl');
	});

	it('passes every other failure through unchanged', async () => {
		const boom = new NotFoundException('This account has no active subscription.');
		const { controller } = build({
			isCustomerOfProduct: true,
			changePlan: jest.fn(async () => {
				throw boom;
			})
		});
		await expect(controller.changePlan({ lookupKey: 'ever_gauzy_x' })).rejects.toBe(boom);
	});
});
