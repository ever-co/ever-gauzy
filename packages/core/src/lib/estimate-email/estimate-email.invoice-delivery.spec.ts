import '../core/entities/internal';

import { RequestContext } from '../core/context';
import { EstimateEmailService } from './estimate-email.service';

/**
 * An invoice's email row names the invoice it delivers and its language from its creation, so no write after the send
 * can fail to and leave the invoice's reminders on an earlier address; when the email does not go, the row forgets
 * both, and stays as the record of an attempt. An estimate's row names nothing.
 *
 * The repositories are doubled: what is under test is what the service writes.
 */
function service() {
	const saved: Record<string, unknown>[] = [];
	const target = Object.create(EstimateEmailService.prototype) as EstimateEmailService;
	Object.assign(target, {
		typeOrmInvoiceRepository: {
			findOneOrFail: jest.fn(async () => ({
				id: 'invoice-43',
				organizationId: 'organization-1',
				organization: { inviteExpiryPeriod: 7, convertAcceptedEstimates: false }
			}))
		},
		save: jest.fn(async (row: Record<string, unknown>) => {
			saved.push({ ...row });
			return { ...row, id: 'estimate-email-1' };
		}),
		update: jest.fn(async () => undefined)
	});
	return { target, saved };
}

describe('EstimateEmailService — where an invoice went', () => {
	beforeEach(() => jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1'));
	afterEach(() => jest.restoreAllMocks());

	it("names the invoice and its language on an invoice's email row when it creates it", async () => {
		const { target, saved } = service();

		await target.createEstimateEmail('invoice-43', 'billing@client.test', { languageCode: 'fr' });

		expect(saved).toEqual([
			expect.objectContaining({ email: 'billing@client.test', invoiceId: 'invoice-43', languageCode: 'fr' })
		]);
	});

	it("names nothing on an estimate's email row", async () => {
		const { target, saved } = service();

		await target.createEstimateEmail('invoice-43', 'buyer@client.test');

		expect(saved).toHaveLength(1);
		expect(saved[0].invoiceId).toBeUndefined();
		expect(saved[0].languageCode).toBeUndefined();
	});

	it('forgets both when the email did not go, and keeps the row', async () => {
		const { target } = service();

		await target.forgetInvoiceDelivery('estimate-email-1');

		expect((target as unknown as { update: jest.Mock }).update).toHaveBeenCalledWith('estimate-email-1', {
			invoiceId: null,
			languageCode: null
		});
	});
});
