import { AddInternalNoteComponent } from './add-internal-note.component';

/**
 * The list behind the dialog reads the invoices again only when the dialog answers, so the dialog cannot be
 * cancelled while the note is saved (#12011).
 */
describe('AddInternalNoteComponent answers', () => {
	const noteDialog = () => {
		const component = Object.create(AddInternalNoteComponent.prototype) as AddInternalNoteComponent &
			Record<string, any>;
		component.invoice = { id: 'invoice-1' };
		component.form = { value: { internalNote: 'Paid by wire' } };
		component.saving = false;
		component['saved'] = false;
		component['_settled'] = Promise.resolve();
		component['invoiceService'] = { updateAction: jest.fn(async () => undefined) };
		component['toastrService'] = { success: jest.fn() };
		component['dialogRef'] = { close: jest.fn() };
		return component;
	};

	it('answers once the note is saved', async () => {
		const component = noteDialog();

		await component.addNote();

		expect(component['dialogRef'].close).toHaveBeenCalledWith(true);
		expect(component.saving).toBe(false);
	});

	it('is saving while the note is on its way, and saves it once', () => {
		const component = noteDialog();
		component['invoiceService'].updateAction = jest.fn(() => new Promise(() => undefined));

		void component.addNote();
		void component.addNote();

		expect(component.saving).toBe(true);
		expect(component['invoiceService'].updateAction).toHaveBeenCalledTimes(1);
	});

	it('can be closed again after a failed save, without an answer', async () => {
		const component = noteDialog();
		component['invoiceService'].updateAction = jest.fn(async () => {
			throw new Error('save');
		});

		await expect(component.addNote()).rejects.toThrow('save');

		expect(component.saving).toBe(false);
		expect(component['dialogRef'].close).not.toHaveBeenCalled();
		await expect(component.changed()).resolves.toBe(false);
	});

	it('tells a list it was closed under (Escape, the backdrop) whether the note was saved, once the save ends', async () => {
		const component = noteDialog();
		let store: () => void;
		component['invoiceService'].updateAction = jest.fn(() => new Promise<void>((resolve) => (store = resolve)));

		const saving = component.addNote();
		const changed = component.changed();
		store();
		await saving;

		await expect(changed).resolves.toBe(true);
	});
});
