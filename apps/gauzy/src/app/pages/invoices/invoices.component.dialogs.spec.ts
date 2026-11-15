import { of } from 'rxjs';
import { InvoicesComponent } from './invoices.component';

/**
 * The Email and Internal note dialogs answer only when they sent or saved something. A cancelled dialog must leave
 * the list as it is: a refresh empties the card grid and takes the list back to its first page (#12011).
 */
describe('InvoicesComponent dialogs', () => {
	const listWithDialogAnswering = (answer: unknown) => {
		const component = Object.create(InvoicesComponent.prototype) as InvoicesComponent & Record<string, any>;
		component.selectedInvoice = { id: 'invoice-1' };
		component.isEstimate = false;
		component['dialogService'] = { open: jest.fn(() => ({ onClose: of(answer) })) };
		const refreshes = jest.fn();
		const reads = jest.fn();
		component['_refresh$'] = { next: refreshes };
		component.invoices$ = { next: reads } as any;
		return { component, refreshes, reads };
	};

	it.each(['email', 'addInternalNote'])('%s: a cancelled dialog leaves the list as it is', (action) => {
		const { component, refreshes, reads } = listWithDialogAnswering(undefined);

		component[action]();

		expect(component['dialogService'].open).toHaveBeenCalledTimes(1);
		expect(refreshes).not.toHaveBeenCalled();
		expect(reads).not.toHaveBeenCalled();
	});

	it.each([
		['email', 'ok'],
		['addInternalNote', true]
	])('%s: what the dialog sent or saved brings the list up to date', (action, answer) => {
		const { component, refreshes, reads } = listWithDialogAnswering(answer);

		component[action]();

		expect(refreshes).toHaveBeenCalledWith(true);
		expect(reads).toHaveBeenCalledWith(true);
	});
});
