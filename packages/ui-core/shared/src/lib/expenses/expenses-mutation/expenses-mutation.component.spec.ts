import { UntypedFormBuilder } from '@angular/forms';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { IExpense } from '@gauzy/contracts';
import { OrganizationSettingService, Store } from '@gauzy/ui-core/core';
import { ExpensesMutationComponent } from './expenses-mutation.component';
import { PLACEHOLDER_RECEIPT } from './expense-receipt.utils';

/**
 * The receipt is form state, so the component is built directly rather than rendered: what is under
 * test is what the form starts with, what it reads from a saved expense and what it hands back.
 */
describe('ExpensesMutationComponent — the receipt is what the user attached, nothing else', () => {
	const UPLOADED = 'https://files.example.com/attach_receipts/receipt-42.png';
	let dialogRef: { close: jest.Mock };
	let component: ExpensesMutationComponent;

	beforeEach(() => {
		dialogRef = { close: jest.fn() };
		component = new ExpensesMutationComponent(
			dialogRef as unknown as NbDialogRef<ExpensesMutationComponent>,
			{} as NbDialogService,
			new UntypedFormBuilder(),
			{} as Store,
			{ instant: (key: string) => key } as unknown as TranslateService,
			{ getDateFromOrganizationSettings: () => new Date(2026, 9, 31) } as unknown as OrganizationSettingService
		);
	});

	const savedExpense = (receipt: string | null): IExpense =>
		({ id: 'expense-1', amount: 120, currency: 'USD', valueDate: new Date(2026, 9, 1), receipt }) as IExpense;

	it('starts a new expense without a receipt', () => {
		expect(component.form.get('receipt').value).toBeNull();
	});

	it('saves a new expense without a receipt when none was attached', () => {
		component.form.patchValue({ amount: 120, currency: 'USD' });

		component.addOrEditExpense();

		expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ receipt: null }));
	});

	it('reads an expense saved with the sample invoice as having no receipt', () => {
		component.expense = savedExpense(PLACEHOLDER_RECEIPT);

		expect(component.form.get('receipt').value).toBeNull();
	});

	it('keeps the receipt an expense really has', () => {
		component.expense = savedExpense(UPLOADED);

		expect(component.form.get('receipt').value).toBe(UPLOADED);
	});

	it('keeps an expense without a receipt without one', () => {
		component.expense = savedExpense(null);

		expect(component.form.get('receipt').value).toBeNull();
	});
});
