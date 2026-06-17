import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	verifyElementNotExist
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { IncomePage } from '../../../src/support/Base/pageobjects/IncomePageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.addIncomeButtonCss);

export const clickAddIncomeButton = async () => {
	// The income page may still be settling right after navigation, so the first
	// force-click on the Add button can land before its (click) handler is wired.
	// Click, then retry until the Add Income dialog (mutation host) is present.
	const page = getPage();
	const dialog = page.locator('ngx-income-mutation');
	for (let i = 0; i < 4; i++) {
		await clickButton(IncomePage.addIncomeButtonCss);
		await page.waitForTimeout(1200);
		if (await dialog.count()) return;
	}
};

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(IncomePage.selectEmployeeDropdownCss);

export const clickEmployeeDropdown = async () => clickButton(IncomePage.selectEmployeeDropdownCss);

export const selectEmployeeFromDropdown = async (index: number) =>
	clickButtonByIndex(IncomePage.selectEmployeeDropdownOptionCss, index);

export const dateInputVisible = async () => verifyElementIsVisible(IncomePage.dateInputCss);

export const enterDateInputData = async () => {
	await clearField(IncomePage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(IncomePage.dateInputCss, date);
};

export const contactInputVisible = async () => verifyElementIsVisible(IncomePage.organizationContactCss);

export const clickContactInput = async () => clickButton(IncomePage.organizationContactCss);

export const enterContactInputData = async (data: string) => {
	// ga-contact-select is an ng-select with addTag: open it, type, create-by-Enter.
	await clickButton(IncomePage.organizationContactCss);
	await enterInput(IncomePage.organizationContactSearchInputCss, data);
	await clickKeyboardBtnByKeycode(13);
};

export const amountInputVisible = async () => verifyElementIsVisible(IncomePage.amountInputCss);

export const enterAmountInputData = async (data: string) => {
	await clearField(IncomePage.amountInputCss);
	await enterInput(IncomePage.amountInputCss, data);
};

export const tagsDropdownVisible = async () => verifyElementIsVisible(IncomePage.addTagsDropdownCss);

export const clickTagsDropdown = async () => clickButton(IncomePage.addTagsDropdownCss);

export const selectTagFromDropdown = async (index: number) => clickButtonByIndex(IncomePage.tagsDropdownOption, index);

export const notesTextareaVisible = async () => verifyElementIsVisible(IncomePage.notesInputCss);

export const enterNotesInputData = async (data: string) => {
	await clearField(IncomePage.notesInputCss);
	await enterInput(IncomePage.notesInputCss, data);
};

export const saveIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.saveIncomeButtonCss);

export const clickSaveIncomeButton = async () => clickButton(IncomePage.saveIncomeButtonCss);

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const tableRowVisible = async () => verifyElementIsVisible(IncomePage.selectTableRowCss);

export const selectTableRow = async (index: number) => {
	// Selecting a smart-table row enables the Edit/Delete actions, but clicking the
	// same row twice toggles the selection back off. Click once, then only re-click
	// if the action buttons are still disabled (first click landed too early).
	const page = getPage();
	const row = page.locator(IncomePage.selectTableRowCss).nth(index);
	const enabledAction = page.locator('div.actions-container button.action.primary:not(.btn-disabled)');
	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		await page.waitForTimeout(700);
		if (await enabledAction.count()) return;
		await row.click({ force: true });
	}
};

export const editIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.editIncomeButtonCss);

export const clickEditIncomeButton = async () => clickButton(IncomePage.editIncomeButtonCss);

export const deleteIncomeButtonVisible = async () => verifyElementIsVisible(IncomePage.deleteIncomeButtonCss);

export const clickDeleteIncomeButton = async () => clickButton(IncomePage.deleteIncomeButtonCss);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(IncomePage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => clickButton(IncomePage.confirmDeleteButtonCss);

export const clickCardBody = async () => clickButton(IncomePage.cardBodyCss);

export const waitMessageToHide = async () => {
	// Poll for the toast to clear instead of the shared util's fixed 10s hard-sleep,
	// which would blow the per-test timeout across the spec's many calls.
	const toast = getPage().locator(IncomePage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast appeared / already gone */
	}
};

export const verifyElementIsDeleted = async () => verifyElementNotExist(IncomePage.verifyIncomeCss);

export const verifyIncomeExists = async (text: string) => {
	// May be several income rows; assert the newest (first) row carries the note text.
	await verifyElementIsVisibleByIndex(IncomePage.verifyIncomeCss, 0);
	await expectFirstRowContains(text);
};

const expectFirstRowContains = async (text: string) => {
	const { expect } = await import('@playwright/test');
	await expect(getPage().locator(IncomePage.verifyIncomeCss).first()).toContainText(text, { timeout: 24000 });
};
