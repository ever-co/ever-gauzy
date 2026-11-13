import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, of } from 'rxjs';
import { IInvoice } from '@gauzy/contracts';
import { ErrorHandlingService, InvoicesService, Store, ToastrService } from '@gauzy/ui-core/core';
import { InvoiceViewComponent } from './invoice-view.component';

/**
 * The invoice page and the estimate page show the same component, which loads the document by its id whatever it is.
 * A link made while a document was an estimate (a client's acceptance in a notification or an email, a favorite) names
 * the estimate page after the document became an invoice, where its edit would save the invoice as an estimate again:
 * the page opens the document on its own page instead.
 */
describe('InvoiceViewComponent', () => {
	/** Opens the page for `document`, as the estimate page (`isEstimate`) or the invoice page. */
	async function open(document: Partial<IInvoice> | null, { isEstimate = false, fails = false } = {}) {
		const router = { navigate: jest.fn() };
		const invoices = {
			getById: jest.fn(async () => {
				if (fails) {
					throw new Error('Not found');
				}
				return document;
			})
		};
		const component = new InvoiceViewComponent(
			{ instant: (key: string) => key } as unknown as TranslateService,
			{ paramMap: of(convertToParamMap({ id: 'document-1' })) } as unknown as ActivatedRoute,
			invoices as unknown as InvoicesService,
			{ danger: jest.fn() } as unknown as ToastrService,
			{ user: { id: 'user-1', tenantId: 'tenant-1' } } as unknown as Store,
			router as unknown as Router,
			{} as NbDialogService,
			{ handleError: jest.fn() } as unknown as ErrorHandlingService
		);
		component.isEstimate = isEstimate;
		component.ngOnInit();
		const shown = await firstValueFrom(component.invoice$);
		return { router, shown };
	}

	it('opens an invoice on the invoice page when a link named the estimate page', async () => {
		const { router, shown } = await open({ id: 'document-1', isEstimate: false }, { isEstimate: true });

		expect(router.navigate).toHaveBeenCalledWith(['/pages/accounting/invoices/view', 'document-1'], {
			replaceUrl: true
		});
		expect(shown).toEqual({ id: 'document-1', isEstimate: false });
	});

	it('opens an estimate on the estimate page when a link named the invoice page', async () => {
		const { router } = await open({ id: 'document-1', isEstimate: true });

		expect(router.navigate).toHaveBeenCalledWith(['/pages/accounting/invoices/estimates/view', 'document-1'], {
			replaceUrl: true
		});
	});

	it.each([
		['an estimate on the estimate page', { id: 'document-1', isEstimate: true }, true],
		['an invoice on the invoice page', { id: 'document-1', isEstimate: false }, false],
		['a document with no estimate flag on the invoice page', { id: 'document-1', isEstimate: null }, false]
	])('stays on its page for %s', async (_, document, isEstimate) => {
		const { router } = await open(document, { isEstimate });

		expect(router.navigate).not.toHaveBeenCalled();
	});

	it('stays when the document cannot be loaded', async () => {
		const { router, shown } = await open(null, { isEstimate: true, fails: true });

		expect(shown).toBeNull();
		expect(router.navigate).not.toHaveBeenCalled();
	});
});
