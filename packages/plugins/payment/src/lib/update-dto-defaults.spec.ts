/**
 * An update body reaches the service holding what the client sent and nothing else (review R3-04, R3-05).
 *
 * The mapped types' constructor copies every field initializer of the DTO it maps, and a `ValidationPipe` builds
 * the body with that constructor, so a partial `PUT` used to arrive carrying the create DTO's defaults:
 * `PUT /payment-collections/:id {metadata}` wrote `authorizedAmount`, `capturedAmount`, `refundedAmount` and
 * `canceledAmount` back to `'0'`, `PUT /payment-providers/:id {name}` re-enabled a disabled provider and switched a
 * test-mode one to live. The controller specs call the handlers with plain objects and never saw it, so this suite
 * runs each update body through the pipe exactly as its route mounts it.
 *
 * `@gauzy/core` is doubled for the reason the package's other specs give (its barrel boots the application graph);
 * `WithoutInitializers` - the one piece this suite is about - comes from `@gauzy/common`, real.
 */
jest.mock('@gauzy/core', () => ({
	TenantOrganizationBaseDTO: class {}
}));

import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdatePaymentCollectionDTO } from './payment-collection/dto';
import { UpdatePaymentProviderDTO } from './payment-provider/dto';
import { UpdatePaymentSessionDTO } from './payment-session/dto';
import { UpdatePaymentWebhookEventDTO } from './payment-webhook-event/dto';
import { UpdateRefundDTO } from './refund/dto';
import { UpdateRefundReasonDTO } from './refund-reason/dto';

/** The pipe every one of these routes mounts: `@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })`. */
const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });

/** What the handler receives for `body`, as the route's pipe hands it over. */
async function received(metatype: ArgumentMetadata['metatype'], body: Record<string, unknown>) {
	return pipe.transform({ ...body }, { type: 'body', metatype });
}

describe('payment update bodies carry only what the client sent', () => {
	it.each([
		['UpdatePaymentCollectionDTO (PUT /payment-collections/:id)', UpdatePaymentCollectionDTO, { metadata: { note: 'corrected' } }],
		['UpdatePaymentProviderDTO (PUT /payment-providers/:id)', UpdatePaymentProviderDTO, { name: 'Stripe EU' }],
		['UpdatePaymentSessionDTO (PUT /payment-sessions/:id, POST /payment-sessions/:id/authorize)', UpdatePaymentSessionDTO, { externalId: 'pi_1' }],
		['UpdatePaymentWebhookEventDTO (PUT /payment-webhook-events/:id)', UpdatePaymentWebhookEventDTO, { lastError: 'timeout' }],
		['UpdateRefundDTO (PUT /refunds/:id, POST /refunds/:id/approve|cancel)', UpdateRefundDTO, { note: 'approved by finance' }]
	])('%s', async (_name, metatype, body) => {
		const result = await received(metatype, body);

		expect({ ...result }).toEqual(body);
	});

	it('an empty body stays empty', async () => {
		for (const metatype of [
			UpdatePaymentCollectionDTO,
			UpdatePaymentProviderDTO,
			UpdatePaymentSessionDTO,
			UpdatePaymentWebhookEventDTO,
			UpdateRefundDTO
		]) {
			expect({ ...(await received(metatype, {})) }).toEqual({});
		}
	});

	it('still validates every member it accepts (the parent metadata is inherited unchanged)', async () => {
		await expect(received(UpdatePaymentProviderDTO, { isTestMode: 'yes' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(received(UpdatePaymentCollectionDTO, { settlementAmount: 1e-9 })).rejects.toBeInstanceOf(
			BadRequestException
		);
		await expect(received(UpdatePaymentSessionDTO, { expiresAt: 'not a date' })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	/**
	 * The GraphQL `UpdatePaymentCollectionInput` admits the settlement, FX and metadata members only; the REST body
	 * admits those and the amount and currency (which `updateCollection` refuses once money has moved). The running
	 * totals, the derived status, the settlement time and the order or cart the collection belongs to are the
	 * server's, and a body that names one is refused rather than written (§3.1: REST no wider than GraphQL).
	 */
	it.each([
		['authorizedAmount', '100'],
		['capturedAmount', '0'],
		['refundedAmount', '0'],
		['canceledAmount', '0'],
		['status', 'AUTHORIZED'],
		['completedAt', '2026-10-14T00:00:00.000Z'],
		['orderId', '7a1f3f53-63d2-4b8e-9d44-5f3c5c0f9b11'],
		['cartId', '7a1f3f53-63d2-4b8e-9d44-5f3c5c0f9b11']
	])('PUT /payment-collections/:id refuses the server-owned member %s', async (member, value) => {
		await expect(received(UpdatePaymentCollectionDTO, { [member]: value })).rejects.toBeInstanceOf(
			BadRequestException
		);
	});

	it('PUT /payment-collections/:id still accepts the members it may change', async () => {
		const body = { amount: '120.00', currency: 'EUR', settlementCurrency: 'USD', fxRate: '1.08', metadata: {} };

		expect({ ...(await received(UpdatePaymentCollectionDTO, body)) }).toEqual(body);
	});
});

// R2-G12: `PUT /refund-reasons/:id` "changes a reason: its label, its description, its parent or its active state",
// and the GraphQL `UpdateRefundReasonInput` carries `isActive`, but the DTO did not declare it: the route mounts
// `forbidNonWhitelisted`, so a body stating it was refused with a 400 and a deactivated reason could only be
// reactivated over GraphQL.
describe('the refund reason update body carries the active state', () => {
	it('accepts isActive, both ways, and nothing else is added', async () => {
		await expect(received(UpdateRefundReasonDTO, { isActive: true })).resolves.toEqual({ isActive: true });
		await expect(received(UpdateRefundReasonDTO, { isActive: false, label: 'Damaged' })).resolves.toEqual({
			isActive: false,
			label: 'Damaged'
		});
	});

	it('still validates it as a boolean, and still refuses an undeclared member', async () => {
		await expect(received(UpdateRefundReasonDTO, { isActive: 'no' })).rejects.toBeInstanceOf(BadRequestException);
		await expect(received(UpdateRefundReasonDTO, { status: 'ACTIVE' })).rejects.toBeInstanceOf(BadRequestException);
	});
});
