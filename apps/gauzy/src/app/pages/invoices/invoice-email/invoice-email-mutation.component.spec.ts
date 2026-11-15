import { InvoiceEmailMutationComponent } from './invoice-email-mutation.component';

/**
 * The list behind the dialog reads the invoices again only when the dialog answers. A cancel answers nothing, so
 * the dialog cannot be cancelled while the email is sent, and once the email went out a close still answers, even
 * when a later step failed (#12011).
 */
describe('InvoiceEmailMutationComponent answers', () => {
	const emailDialog = () => {
		const component = Object.create(InvoiceEmailMutationComponent.prototype) as InvoiceEmailMutationComponent &
			Record<string, any>;
		component.invoice = { id: 'invoice-1', invoiceNumber: 7, fromOrganization: { id: 'org-1' } };
		component.isEstimate = false;
		component.form = { value: { email: 'client@example.com' } };
		component.sending = false;
		component['sent'] = false;
		component['store'] = { user: { tenantId: 'tenant-1' } };
		component['invoiceService'] = {
			sendEmail: jest.fn(async () => undefined),
			updateAction: jest.fn(async () => undefined)
		};
		component['toastrService'] = { success: jest.fn() };
		component['dialogRef'] = { close: jest.fn() };
		component.invoiceEstimateSendHistory = jest.fn(async () => undefined);
		return component;
	};

	it('answers once the email is sent', async () => {
		const component = emailDialog();

		await component.sendEmail();

		expect(component['dialogRef'].close).toHaveBeenCalledWith('ok');
		expect(component.sending).toBe(false);
	});

	it('is sending while the email is on its way, and sends it once', () => {
		const component = emailDialog();
		component['invoiceService'].sendEmail = jest.fn(() => new Promise(() => undefined));

		void component.sendEmail();
		void component.sendEmail();

		expect(component.sending).toBe(true);
		expect(component['invoiceService'].sendEmail).toHaveBeenCalledTimes(1);
	});

	it('a cancel before anything was sent answers nothing', () => {
		const component = emailDialog();

		component.cancel();

		expect(component['dialogRef'].close).toHaveBeenCalledWith(undefined);
	});

	it('a close after the email went out still answers, when a later step failed', async () => {
		const component = emailDialog();
		component.invoiceEstimateSendHistory = jest.fn(async () => {
			throw new Error('history');
		});

		await expect(component.sendEmail()).rejects.toThrow('history');
		expect(component.sending).toBe(false);

		component.cancel();

		expect(component['dialogRef'].close).toHaveBeenCalledWith('ok');
	});
});
