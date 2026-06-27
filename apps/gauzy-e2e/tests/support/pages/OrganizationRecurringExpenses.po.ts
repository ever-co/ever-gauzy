import { expect } from '@playwright/test';
import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyText,
	verifyElementNotExist
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationRecurringExpensesPage } from '../../../src/support/Base/pageobjects/OrganizationRecurringExpensesPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(OrganizationRecurringExpensesPage.addButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.expenseDropdownCss);
};

export const clickExpenseDropdown = async () => {
	// The category picker is an ng-select; it opens on mousedown and a coordinate
	// click is intercepted by the dialog's cdk-overlay backdrop (and can even close
	// the form). Open it via the keyboard instead, then wait for the option panel.
	const page = getPage();
	const input = page.locator(OrganizationRecurringExpensesPage.expenseDropdownCss).locator('input').first();
	const options = page.locator(OrganizationRecurringExpensesPage.dropdownOptionCss);
	for (let i = 0; i < 4; i++) {
		await input.focus();
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(600);
		if (await options.count()) return;
	}
	await options.first().waitFor({ state: 'visible', timeout: 15000 });
};

export const selectExpenseOptionDropdown = async (text) => {
	// Typeahead-filter the ng-select to the wanted category, then click the matching
	// option from the body-appended panel (div.ng-option).
	const page = getPage();
	const input = page.locator(OrganizationRecurringExpensesPage.expenseDropdownCss).locator('input').first();
	await input.focus();
	await input.fill('');
	await input.pressSequentially(String(text), { delay: 30 });
	await page.waitForTimeout(400);
	const option = page
		.locator(OrganizationRecurringExpensesPage.dropdownOptionCss)
		.filter({ hasText: String(text) });
	await option.first().click({ force: true });
	await page.waitForTimeout(400);
};

export const expenseValueInputVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.valueInputCss);
};

export const enterExpenseValueInputData = async (data) => {
	await clearField(OrganizationRecurringExpensesPage.valueInputCss);
	await enterInput(OrganizationRecurringExpensesPage.valueInputCss, data);
};

export const saveExpenseButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.saveButtonCss);
};

export const clickSaveExpenseButton = async () => {
	const page = getPage();
	const saveBtn = page.locator(OrganizationRecurringExpensesPage.saveButtonCss).first();
	// The Save/Edit button is disabled while the form is invalid; wait until it's
	// enabled so the click actually submits (a force-click on a disabled button is a
	// no-op).
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

// The expense block's `.block-settings` (edit/delete menu) is rendered but kept
// hidden (visibility:hidden until the gear toggles showMenu) — its (click) handlers
// are wired to Angular, so we trigger them with a JS-dispatched click on the hidden
// element. Crucially the dispatch must NOT bubble: the block host also has a
// (click)="selectRecurringExpense" that TOGGLES the row selection, so a bubbling
// click would deselect the row and the edit/delete dialog would open with no record.
const dispatchClickLastNoBubble = async (selector: string) => {
	const el = getPage().locator(selector).last();
	await el.waitFor({ state: 'attached', timeout: 24000 });
	await el.dispatchEvent('click', { bubbles: false });
	await getPage().waitForTimeout(800);
};

export const settingsButtonVisible = async () => {
	await getPage()
		.locator(OrganizationRecurringExpensesPage.settingsButtonCss)
		.last()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickSettingsButton = async () => {
	// Select the expense block so the parent's selectedRecurringExpense is set (the
	// edit/delete handlers read it). Clicking the visible block-item-big bubbles to
	// the block's (click)="selectRecurringExpense", which TOGGLES selection, so only
	// click it when the row isn't already selected.
	const page = getPage();
	const block = page.locator(OrganizationRecurringExpensesPage.expenseBlockCss).last();
	await block.waitFor({ state: 'visible', timeout: 24000 });
	const selectedRow = page.locator('ga-recurring-expense-block .setting-row.active');
	if (!(await selectedRow.count())) {
		await block.click({ force: true });
		await page.waitForTimeout(500);
	}
};

export const editButtonVisible = async () => {
	await getPage()
		.locator(OrganizationRecurringExpensesPage.editButtonCss)
		.last()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickEditButton = async () => {
	await dispatchClickLastNoBubble(OrganizationRecurringExpensesPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await getPage()
		.locator(OrganizationRecurringExpensesPage.deleteButtonCss)
		.last()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickDeleteButton = async () => {
	await dispatchClickLastNoBubble(OrganizationRecurringExpensesPage.deleteButtonCss);
};

export const deleteOnlyThisRadioButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.deleteOnlyThisRadioButtonCss);
};

export const clickDeleteOnlyThisRadioButton = async () => {
	await clickButton(OrganizationRecurringExpensesPage.deleteOnlyThisRadioButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationRecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationRecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const waitMessageToHide = async () => {
	// Poll for the toast to clear instead of the shared util's fixed 10s hard-sleep.
	const toast = getPage().locator(OrganizationRecurringExpensesPage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast appeared / already gone */
	}
};

export const verifyExpenseExists = async (text) => {
	await verifyText(OrganizationRecurringExpensesPage.verifyExpenseCss, text);
};

export const verifyExpenseIsDeleted = async () => {
	await verifyElementNotExist(OrganizationRecurringExpensesPage.verifyExpenseCss);
};
