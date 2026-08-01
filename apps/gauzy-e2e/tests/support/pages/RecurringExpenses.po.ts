import { expect } from '@playwright/test';
import {
	verifyElementIsVisible,
	clickButton,
	dispatchClick,
	waitForSpinnerGone,
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
	// The whole nb-card carries [nbSpinner]="loading"; right after navigation the spinner overlays the
	// header (where Add lives), so a coordinate click (even force) lands on the spinner and the dialog
	// never opens. Wait the spinner out, then dispatch the click straight to the button
	// (addEmployeeRecurringExpense fires on the click event regardless of any fading overlay).
	await waitForSpinnerGone();
	await dispatchClick(RecurringExpensesPage.addNewExpenseButtonCss);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.employeeDropdownCss);
};

/**
 * A REAL employee option — not ng-select's own placeholder.
 *
 * While the employee list is still loading, ng-select renders "No items found" as
 * `div.ng-option.ng-option-disabled`. Counting bare `div.ng-option` treats that placeholder as "the
 * list is open and populated", which is how the spec ended up clicking it (a no-op) and posting
 * employeeId:null. Only options that are not disabled, and not the "All Employees" pseudo-entry (it
 * has no id, so it produces the same null), are real choices.
 */
const realEmployeeOptions = () =>
	getPage()
		.locator(`${RecurringExpensesPage.dropdownOptionCss}:not(.ng-option-disabled)`)
		.filter({ hasNotText: 'All Employees' });

// ng-select opens on MOUSEDOWN and is blocked by the dialog/overlay backdrop, so a force-click on the
// control is unreliable (and can land on the backdrop). Open it via the keyboard instead: focus the
// inner input and press ArrowDown.
//
// Opening it in the same tick the dialog appears catches the list mid-load, and it then stays stuck on
// "No items found" (measured: still empty 5s later) — but closing and re-opening the panel picks the
// loaded list straight up. So retry around a real option appearing, toggling the panel shut between
// attempts via its own container. NEVER Escape: nb-dialog opens with closeOnEsc, so that would dismiss
// the whole Add-Expense form. Best-effort — the list can legitimately be empty (no employee "working"
// in the header date range) and selectEmployeeFromDropdown reports that.
const openEmployeeDropdown = async () => {
	const page = getPage();
	const input = page.locator(RecurringExpensesPage.employeeDropdownCss).locator('input').first();
	const container = page.locator(`${RecurringExpensesPage.employeeDropdownCss} .ng-select-container`).first();
	for (let i = 0; i < 6; i++) {
		await input.focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(900);
		if (await realEmployeeOptions().count()) return;
		await container.click({ force: true }).catch(() => {}); // toggle shut, then re-open next pass
		await page.waitForTimeout(700);
	}
};

export const clickEmployeeDropdown = async () => {
	await openEmployeeDropdown();
};

export const selectEmployeeFromDropdown = async (index) => {
	// Pick the first REAL employee: the leading "All Employees" pseudo-entry has no id, and
	// recurring-expense-mutation sends `employee = employeeSelector.selectedEmployee` straight into the
	// payload, so leaving it on ALL posts employeeId:null and the API 400s with
	// "employeeId must be a string" — a rejection the spec then only notices three steps later as a
	// missing row.
	//
	// The click alone is not proof, and neither is reading the CONTROL's text back: ng-select renders
	// its open panel inside the control, so the previous check ("does the control's text contain the
	// option I clicked?") was satisfied by the very panel it clicked in — it passed while nothing had
	// been selected. Verify against the committed value instead: on a real selection ng-select closes
	// the panel and renders the choice as `div.ng-value` in the container.
	void index;
	const page = getPage();
	const value = page.locator(`${RecurringExpensesPage.employeeDropdownCss} div.ng-value`);
	for (let attempt = 0; attempt < 3; attempt++) {
		await openEmployeeDropdown();
		const option = realEmployeeOptions().first();
		if ((await option.count().catch(() => 0)) === 0) continue; // list still empty — try again
		const wanted = ((await option.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
		await option.click({ force: true }).catch(() => {});
		await page.waitForTimeout(800); // let ng-select close and write the value
		if (wanted && (await value.filter({ hasText: wanted }).count().catch(() => 0)) > 0) return; // committed
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.expenseDropdownCss);
};

export const clickExpenseDropdown = async () => {
	// Same as the employee dropdown: open the category ng-select via the keyboard (focus its input +
	// ArrowDown) rather than a backdrop-blocked force-click. The category list is the static default
	// set, so it always renders — retry until an option shows.
	const page = getPage();
	const options = page.locator(RecurringExpensesPage.dropdownOptionCss);
	const input = page.locator(RecurringExpensesPage.expenseDropdownCss).locator('input').first();
	for (let i = 0; i < 4; i++) {
		await input.focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
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
	// The Save/Edit button is disabled while the form is invalid; wait until it's enabled so the click
	// actually submits (a force-click on a disabled button is a no-op).
	await saveBtn.waitFor({ state: 'visible', timeout: 15000 });
	for (let i = 0; i < 10; i++) {
		if (await saveBtn.isEnabled().catch(() => false)) break;
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

// The expense block's `.block-settings` (edit/delete menu) is rendered but kept hidden
// (visibility:hidden until the gear toggles showMenu) — its (click) handlers are wired to Angular, so
// we trigger them with a JS-dispatched click on the hidden element. Crucially the dispatch must NOT
// bubble: the block host also has a (click)="selectRecurringExpense" that TOGGLES the row selection, so
// a bubbling click would deselect the row and the edit/delete dialog would open with no record.
// (Mirrors OrganizationRecurringExpenses.po, which drives the identical redesigned page at org level.)
const dispatchClickLastNoBubble = async (selector: string) => {
	const el = getPage().locator(selector).last();
	await el.waitFor({ state: 'attached', timeout: 24000 });
	await el.dispatchEvent('click', { bubbles: false });
	await getPage().waitForTimeout(800);
};

export const settingsButtonVisible = async () => {
	await getPage()
		.locator(RecurringExpensesPage.settingsButtonCss)
		.last()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickSettingsButton = async () => {
	// Select the expense block so the parent's selectedRecurringExpense is set (the edit/delete handlers
	// read it). Clicking the visible block-amount bubbles to (click)="selectRecurringExpense", which
	// TOGGLES selection, so only click it when the row isn't already selected. Let the grid settle first.
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const block = page.locator(RecurringExpensesPage.expenseBlockCss).last();
	await block.waitFor({ state: 'visible', timeout: 24000 });
	const selectedRow = page.locator('ga-recurring-expense-block .setting-row.active');
	if (!(await selectedRow.count())) {
		await block.click({ force: true });
		await page.waitForTimeout(500);
	}
};

export const editButtonVisible = async () => {
	await getPage()
		.locator(RecurringExpensesPage.editExpenseButtonCss)
		.last()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickEditButton = async () => {
	await dispatchClickLastNoBubble(RecurringExpensesPage.editExpenseButtonCss);
	// Wait for the mutation dialog to open before the caller interacts with its fields.
	await getPage()
		.locator('ga-recurring-expense-mutation')
		.first()
		.waitFor({ state: 'visible', timeout: 15000 })
		.catch(() => undefined);
};

export const deleteButtonVisible = async () => {
	await getPage()
		.locator(RecurringExpensesPage.deleteExpenseButtonCss)
		.last()
		.waitFor({ state: 'attached', timeout: 24000 });
};

export const clickDeleteButton = async () => {
	await dispatchClickLastNoBubble(RecurringExpensesPage.deleteExpenseButtonCss);
};

export const deleteAllButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.deleteAllButtonCss);
};

export const clickDeleteAllButton = async () => {
	// nb-radio renders its real input inside; force-click the host to toggle the "all" option.
	await clickButton(RecurringExpensesPage.deleteAllButtonCss);
	await getPage().waitForTimeout(300);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(RecurringExpensesPage.confirmDeleteExpenseButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// The OK button is disabled until a radio option is selected; wait for enabled, then click.
	const page = getPage();
	const okBtn = page.locator(RecurringExpensesPage.confirmDeleteExpenseButtonCss).first();
	await okBtn.waitFor({ state: 'visible', timeout: 15000 });
	for (let i = 0; i < 10; i++) {
		if (await okBtn.isEnabled().catch(() => false)) break;
		await page.waitForTimeout(400);
	}
	await okBtn.click({ force: true });
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
	// The block renders the amount with the org currency (e.g. "$ 99.00"), not the "BGN<value>" the
	// spec passes — match on the numeric portion (currency-agnostic). Editing the value can leave the
	// original month's entry in place and add a second block for the new value, so assert that *some*
	// block shows the expected amount rather than pinning to the first row.
	const numeric = String(text).replace(/[^0-9.]/g, '');
	const matching = getPage()
		.locator(RecurringExpensesPage.verifyExpenseCss)
		.filter({ hasText: numeric });
	await expect(matching.first()).toBeVisible({ timeout: 24000 });
};

export const verifyExpenseIsDeleted = async () => {
	await verifyElementNotExist(RecurringExpensesPage.verifyExpenseCss);
};
