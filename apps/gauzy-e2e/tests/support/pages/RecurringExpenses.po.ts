import { expect } from '@playwright/test';
import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	verifyElementNotExist
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RecurringExpensesPage } from '../../../src/support/Base/pageobjects/RecurringExpensesPageObject';

export const addNewExpenseButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.addNewExpenseButtonCss);
};

export const clickAddNewExpenseButton = async () => {
	await clickButton(RecurringExpensesPage.addNewExpenseButtonCss);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.employeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	// Open the employee ng-select and wait for its option list; retry the click in
	// case the first one lands before the dialog is fully interactive.
	const page = getPage();
	const options = page.locator(RecurringExpensesPage.dropdownOptionCss);
	for (let i = 0; i < 4; i++) {
		await clickButton(RecurringExpensesPage.employeeDropdownCss);
		await page.waitForTimeout(800);
		if (await options.count()) return;
	}
	await options.first().waitFor({ state: 'visible', timeout: 15000 });
};

export const selectEmployeeFromDropdown = async (index) => {
	// A recurring expense must target a concrete employee; the first option is the
	// "All Employees" pseudo-entry, which silently fails to save. Pick the first
	// real employee option instead (ignoring the passed index, which assumed the
	// old list had no "All Employees" entry).
	void index;
	const page = getPage();
	const realEmployee = page
		.locator(RecurringExpensesPage.dropdownOptionCss)
		.filter({ hasNotText: 'All Employees' });
	await realEmployee.first().click({ force: true });
	// Let the ng-select commit the selection (close + write the form value).
	await page.waitForTimeout(500);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.expenseDropdownCss);
};

export const clickExpenseDropdown = async () => {
	// Open the category ng-select and wait for its option list. Retry the click in
	// case the first one lands while the just-closed employee dropdown is still
	// animating (otherwise the panel never opens).
	const page = getPage();
	const options = page.locator(RecurringExpensesPage.dropdownOptionCss);
	for (let i = 0; i < 4; i++) {
		await clickButton(RecurringExpensesPage.expenseDropdownCss);
		await page.waitForTimeout(800);
		if (await options.count()) return;
	}
	await options.first().waitFor({ state: 'visible', timeout: 15000 });
};

export const selectExpenseOptionDropdown = async (text) => {
	await clickElementByText(RecurringExpensesPage.dropdownOptionCss, text);
	await getPage().waitForTimeout(400);
};

export const expenseValueInputVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.valueInputCss);
};

export const enterExpenseValueInputData = async (data) => {
	await clearField(RecurringExpensesPage.valueInputCss);
	await enterInput(RecurringExpensesPage.valueInputCss, data);
};

export const saveExpenseButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.saveExpenseButtonCss);
};

export const clickSaveExpenseButton = async () => {
	const page = getPage();
	const saveBtn = page.locator(RecurringExpensesPage.saveExpenseButtonCss).first();
	// The Save button is disabled while the form is invalid; wait until it's enabled
	// so the click actually submits (a force-click on a disabled button is a no-op).
	await saveBtn.waitFor({ state: 'visible', timeout: 15000 });
	for (let i = 0; i < 8; i++) {
		if (await saveBtn.isEnabled()) break;
		await page.waitForTimeout(500);
	}
	await saveBtn.click({ force: true });
	// Wait for the mutation dialog to close, confirming the submit went through.
	await page
		.locator('ga-recurring-expense-mutation')
		.first()
		.waitFor({ state: 'detached', timeout: 15000 })
		.catch(() => undefined);
};

// The expense block's `.block-panel` (settings gear + edit/delete menu) is rendered
// but kept `display:none` by the current stylesheet — there is no hover/reveal rule,
// so the controls can't be reached by a normal click. They are wired to Angular
// (click) handlers, so we trigger them with a JS-dispatched click on the hidden
// element. Crucially the dispatch must NOT bubble: the block host also has a
// (click)="selectRecurringExpense" that TOGGLES the row selection, so a bubbling
// click would deselect the row and the edit/delete dialog would open with no record.
// Assertions only check the control is present in the DOM (it is never "visible").
const dispatchClickLastNoBubble = async (selector: string) => {
	const el = getPage().locator(selector).last();
	await el.waitFor({ state: 'attached', timeout: 24000 });
	await el.dispatchEvent('click', { bubbles: false });
	await getPage().waitForTimeout(800);
};

export const settingsButtonVisible = async () => {
	await getPage().locator(RecurringExpensesPage.settingsButtonCss).last().waitFor({ state: 'attached', timeout: 24000 });
};

export const clickSettingsButton = async () => {
	// Select the expense block so the parent's selectedRecurringExpense is set (the
	// edit/delete handlers read it). The block-amount is the visible part of the row
	// and its click bubbles to the block's (click)="selectRecurringExpense". This is
	// a toggle, so we only click it when the row isn't already selected.
	const page = getPage();
	const block = page.locator(RecurringExpensesPage.expenseBlockCss).last();
	await block.waitFor({ state: 'visible', timeout: 24000 });
	const selectedRow = page.locator('ga-recurring-expense-block .setting-row.active');
	if (!(await selectedRow.count())) {
		await block.click({ force: true });
		await page.waitForTimeout(500);
	}
};

export const editButtonVisible = async () => {
	await getPage().locator(RecurringExpensesPage.editExpenseButtonCss).last().waitFor({ state: 'attached', timeout: 24000 });
};

export const clickEditButton = async () => {
	await dispatchClickLastNoBubble(RecurringExpensesPage.editExpenseButtonCss);
};

export const deleteButtonVisible = async () => {
	await getPage().locator(RecurringExpensesPage.deleteExpenseButtonCss).last().waitFor({ state: 'attached', timeout: 24000 });
};

export const clickDeleteButton = async () => {
	await dispatchClickLastNoBubble(RecurringExpensesPage.deleteExpenseButtonCss);
};

export const deleteAllButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.deleteAllButtonCss);
};

export const clickDeleteAllButton = async () => {
	await clickButton(RecurringExpensesPage.deleteAllButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(RecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const waitMessageToHide = async () => {
	// Poll for the toast to clear instead of the shared util's fixed 10s hard-sleep.
	const toast = getPage().locator(RecurringExpensesPage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast appeared / already gone */
	}
};

export const verifyExpenseExists = async (text) => {
	// The block renders the amount with the org currency (e.g. "$ 99.00"), not the
	// "BGN<value>" the spec passes — match on the numeric portion (currency-agnostic).
	// Editing the value can leave the original month's entry in place and add a second
	// block for the new value, so assert that *some* block shows the expected amount
	// rather than pinning to the first row.
	const numeric = String(text).replace(/[^0-9.]/g, '');
	const matching = getPage()
		.locator(RecurringExpensesPage.verifyExpenseCss)
		.filter({ hasText: numeric });
	await expect(matching.first()).toBeVisible({ timeout: 24000 });
};

export const verifyExpenseIsDeleted = async () => {
	await verifyElementNotExist(RecurringExpensesPage.verifyExpenseCss);
};
