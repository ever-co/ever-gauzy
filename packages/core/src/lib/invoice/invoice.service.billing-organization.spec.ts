import { BadRequestException } from '@nestjs/common';
import { IInvoiceCreateInput, IInvoiceItemCreateInput } from '@gauzy/contracts';
import * as billedTime from '../invoice-item/invoice-item-billed-time';
import { TIME_LOG_NOT_BILLABLE } from '../invoice-item/invoice-item-billed-time';
import { InvoiceService } from './invoice.service';

const ORG_A = '6a0f2a1e-0000-4000-8000-00000000000a';
const ORG_B = '6a0f2a1e-0000-4000-8000-00000000000b';
const TIME_LOG = '6a0f2a1e-0000-4000-8000-0000000000c1';

/**
 * `POST /invoices` with lines that bill time: `create()` holds the INVOICE's organization to the caller's boundary,
 * not the organization each nested line states. A line may therefore only bill time of its invoice's organization,
 * or a member of two organizations could bill one organization's time on the other's invoice (review of #11873).
 */
describe('InvoiceService.createWithBilledTime — a line bills only its invoice organization', () => {
	let service: InvoiceService;
	let saveBillingTime: jest.SpyInstance;

	beforeEach(() => {
		service = new InvoiceService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
		saveBillingTime = jest.spyOn(billedTime, 'saveBillingTime').mockResolvedValue({ id: 'invoice' } as never);
	});

	afterEach(() => jest.restoreAllMocks());

	const invoice = (organizationId: string, lineOrganizationId: string) =>
		({
			organizationId,
			invoiceItems: [{ organizationId: lineOrganizationId, timeLogIds: [TIME_LOG] } as IInvoiceItemCreateInput]
		}) as IInvoiceCreateInput & { invoiceItems: IInvoiceItemCreateInput[] };

	it('refuses a line that bills another organization’s time, before anything is written', async () => {
		const refusal = await service.createWithBilledTime(invoice(ORG_A, ORG_B)).catch((thrown) => thrown);

		expect(refusal).toBeInstanceOf(BadRequestException);
		expect(refusal.message).toBe(TIME_LOG_NOT_BILLABLE);
		expect(saveBillingTime).not.toHaveBeenCalled();
	});

	it('bills the time of the invoice’s own organization', async () => {
		await expect(service.createWithBilledTime(invoice(ORG_A, ORG_A))).resolves.toEqual({ id: 'invoice' });
		expect(saveBillingTime).toHaveBeenCalledTimes(1);
	});
});
