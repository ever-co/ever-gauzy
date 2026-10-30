import { ActivatedRoute, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { IInvoice, InvoiceStatusTypesEnum, IPayment } from '@gauzy/contracts';
import {
	InvoiceEstimateHistoryService,
	InvoicesService,
	PaymentService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { InvoicePaymentsComponent } from './payments.component';

const ORGANIZATION = { id: 'org-1', tenantId: 'tenant-1' };

const invoiceWith = (amounts: number[]): IInvoice =>
	({
		id: 'invoice-1',
		totalValue: 100,
		currency: 'USD',
		fromOrganization: ORGANIZATION,
		payments: amounts.map((amount, index) => ({ id: `payment-${index}`, amount }) as IPayment)
	}) as unknown as IInvoice;

/**
 * A payment added, edited or deleted sets the invoice's status from the payments as the server has them after
 * the change, never from the totals read before it.
 */
describe('InvoicePaymentsComponent', () => {
	let invoices: { getById: jest.Mock; updateAction: jest.Mock };
	let payments: { add: jest.Mock; update: jest.Mock; delete: jest.Mock };
	let dialogResult: unknown;

	const statusWritten = () =>
		invoices.updateAction.mock.calls.map(([, input]) => input).filter((input) => 'status' in input);

	const component = async (amountsBefore: number[]) => {
		const instance = new InvoicePaymentsComponent(
			{ paramMap: of() } as unknown as ActivatedRoute,
			{ instant: (key: string) => key } as unknown as TranslateService,
			invoices as unknown as InvoicesService,
			{ open: () => ({ onClose: of(dialogResult) }) } as unknown as NbDialogService,
			payments as unknown as PaymentService,
			{ success: jest.fn(), danger: jest.fn() } as unknown as ToastrService,
			{ selectedOrganization: ORGANIZATION, user: { id: 'user-1', tenantId: 'tenant-1' } } as unknown as Store,
			{ add: jest.fn(async () => ({})) } as unknown as InvoiceEstimateHistoryService,
			{ navigate: jest.fn() } as unknown as Router
		);
		instance.invoiceId = 'invoice-1';
		invoices.getById.mockResolvedValueOnce(invoiceWith(amountsBefore));
		await instance.getInvoice();
		invoices.updateAction.mockClear();
		return instance;
	};

	beforeEach(() => {
		document.body.innerHTML = '<div id="progress-bar-inner"></div>';
		invoices = { getById: jest.fn(), updateAction: jest.fn(async () => ({})) };
		payments = {
			add: jest.fn(async () => ({})),
			update: jest.fn(async () => ({})),
			delete: jest.fn(async () => ({}))
		};
		dialogResult = undefined;
	});

	it('reads the payments again before the status, a payment added', async () => {
		const instance = await component([40]);
		dialogResult = { amount: 60, currency: 'USD' };
		invoices.getById.mockResolvedValueOnce(invoiceWith([40, 60]));

		await instance.recordPayment();

		expect(payments.add).toHaveBeenCalled();
		expect(statusWritten()).toEqual([{ status: InvoiceStatusTypesEnum.FULLY_PAID }]);
		expect(instance.totalPaid).toBe(100);
	});

	it('reads the payments again before the status, a payment edited', async () => {
		const instance = await component([40]);
		dialogResult = { id: 'payment-0', amount: 30, currency: 'USD' };
		invoices.getById.mockResolvedValueOnce(invoiceWith([30]));

		await instance.editPayment();

		expect(payments.update).toHaveBeenCalledWith('payment-0', dialogResult);
		expect(statusWritten()).toEqual([{ status: InvoiceStatusTypesEnum.PARTIALLY_PAID }]);
	});

	it('reads the payments again before the status, a payment deleted', async () => {
		const instance = await component([40]);
		instance.selectedPayment = instance.payments[0];
		dialogResult = true;
		invoices.getById.mockResolvedValueOnce(invoiceWith([]));

		await instance.deletePayment();

		expect(payments.delete).toHaveBeenCalledWith('payment-0');
		expect(statusWritten()).toEqual([{ status: InvoiceStatusTypesEnum.VIEWED }]);
		expect(instance.totalPaid).toBe(0);
	});

	it('sets the status once the rest is paid in full', async () => {
		const instance = await component([40]);
		invoices.getById.mockResolvedValueOnce(invoiceWith([40, 60]));

		await instance.recordFullPayment();

		expect(payments.add).toHaveBeenCalledWith(expect.objectContaining({ amount: 60 }));
		expect(statusWritten()).toEqual([{ status: InvoiceStatusTypesEnum.FULLY_PAID }]);
	});
});
