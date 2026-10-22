/**
 * Load the entity graph FIRST, as the application does: the service reaches the email service, whose
 * import through the validators otherwise leaves an entity decorator undefined.
 */
import '../core/entities/internal';

import { ForbiddenException } from '@nestjs/common';
import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { PaymentService } from './payment.service';

/**
 * `POST /payments/receipt` and `sendPaymentReceipt` send a receipt through the organization's mail settings and
 * file it in the email history under the organization the caller states, and that organization's `tenantId` as
 * stated. A caller could file a rendered receipt into another tenant's email history, under an organization it
 * does not belong to.
 */
describe('PaymentService.sendReceipt — the receipt stays in the caller’s tenant and organizations', () => {
	const TENANT = '11111111-1111-4111-8111-111111111111';
	const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';
	const MINE = '33333333-3333-4333-8333-333333333333';
	const THEIRS = '44444444-4444-4444-8444-444444444444';

	let sendPaymentReceipt: jest.Mock;
	let service: PaymentService;

	const invoice = (fromOrganization: Record<string, unknown>) =>
		({
			invoiceNumber: 7,
			toContact: { primaryEmail: 'client@example.com', name: 'Client' },
			fromOrganization
		}) as any;
	const payment = { amount: 10, currency: 'USD' } as any;

	beforeEach(() => {
		sendPaymentReceipt = jest.fn().mockResolvedValue(undefined);
		// The membership lookup: a `user_organization` row exists for the caller's own organization only.
		const manager = { count: jest.fn(async (_entity, { where }) => (where.organizationId === MINE ? 1 : 0)) };
		service = new PaymentService({ manager } as any, {} as any, { sendPaymentReceipt } as any);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue('user-1');
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses an organization the caller does not belong to, before anything is sent', async () => {
		await expect(
			service.sendReceipt(LanguagesEnum.ENGLISH, invoice({ id: THEIRS, name: 'Theirs' }), payment, 'origin')
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(sendPaymentReceipt).not.toHaveBeenCalled();
	});

	it('files the receipt under the caller’s own tenant, whatever tenant the body states', async () => {
		await expect(
			service.sendReceipt(
				LanguagesEnum.ENGLISH,
				invoice({ id: MINE, name: 'Mine', tenantId: OTHER_TENANT }),
				payment,
				'origin'
			)
		).resolves.toBe(true);

		const organization = sendPaymentReceipt.mock.calls[0][6];
		expect(organization).toMatchObject({ id: MINE, name: 'Mine', tenantId: TENANT });
	});
});
