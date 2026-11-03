import { UntypedFormBuilder } from '@angular/forms';
import { NbDialogRef, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { ExpenseTypesEnum, IExpense, TaxTypesEnum } from '@gauzy/contracts';
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

describe('ExpensesMutationComponent — included taxes can be taken out again', () => {
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

	it('hides the tax fields and saves the expense without a tax', () => {
		component.expense = {
			id: 'expense-1',
			amount: 120,
			currency: 'USD',
			valueDate: new Date(2026, 9, 1),
			taxLabel: 'VAT',
			taxType: TaxTypesEnum.VALUE,
			rateValue: 20
		} as IExpense;
		expect(component.showTaxesInput).toBe(true);

		component.removeTaxes();
		component.addOrEditExpense();

		expect(component.showTaxesInput).toBe(false);
		expect(dialogRef.close).toHaveBeenCalledWith(
			expect.objectContaining({ taxLabel: null, taxType: TaxTypesEnum.PERCENTAGE, rateValue: 0 })
		);
	});

	it('shows the tax fields again when the taxes are included after being removed', () => {
		component.includeTaxes();
		component.removeTaxes();
		component.includeTaxes();

		expect(component.showTaxesInput).toBe(true);
	});
});

describe('ExpensesMutationComponent — the split, the warning and the type keyboard', () => {
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

	const unsplit = { id: 'expense-1', amount: 120, currency: 'USD', valueDate: new Date(2026, 9, 1), splitExpense: false };

	it('keeps an edited expense unsplit when the hidden employee selector reports "All employees"', () => {
		component.expense = unsplit as IExpense;
		component.onEmployeeChange(null);

		component.addOrEditExpense();

		expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ splitExpense: false }));
	});

	it('splits a duplicate as its employee selector says', () => {
		component.duplicate = true;
		component.expense = unsplit as IExpense;
		component.onEmployeeChange(null);

		component.addOrEditExpense();

		expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ splitExpense: true }));
	});

	it('keeps the warning closed when its timeout fires after it was dismissed', () => {
		jest.useFakeTimers();
		try {
			component.form.patchValue({ typeOfExpense: ExpenseTypesEnum.BILLABLE_TO_CONTACT });
			component.addOrEditExpense();
			expect(component.showWarning).toBe(true);

			component.closeWarning();
			jest.advanceTimersByTime(3000);

			expect(component.showWarning).toBe(false);
		} finally {
			jest.useRealTimers();
		}
	});

	it('moves the type with the arrow keys, Home and End, wrapping at the ends', () => {
		const key = (name: string, index: number) => {
			const event = { key: name, preventDefault: jest.fn(), currentTarget: null } as unknown as KeyboardEvent;
			component.onExpenseTypeKeydown(event, index);
			return event;
		};
		const [first, , last] = component.expenseTypes;

		key('ArrowLeft', 0);
		expect(component.form.get('typeOfExpense').value).toBe(last);
		key('ArrowRight', 2);
		expect(component.form.get('typeOfExpense').value).toBe(first);
		key('End', 0);
		expect(component.form.get('typeOfExpense').value).toBe(last);
		key('Home', 2);
		expect(component.form.get('typeOfExpense').value).toBe(first);
		expect(key('Tab', 0).preventDefault).not.toHaveBeenCalled();
	});

	it('makes only the selected type a Tab stop', () => {
		const selected = component.form.get('typeOfExpense').value;

		expect(component.expenseTypes.filter((type, index) => component.isExpenseTypeTabStop(type, index))).toEqual([
			selected
		]);
	});
});
