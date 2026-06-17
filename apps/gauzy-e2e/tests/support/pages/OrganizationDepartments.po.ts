import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	verifyText,
	verifyTextNotExisting,
	waitElementToHide,
	getLastElement
} from '../util';
import { expect } from '@playwright/test';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationDepartmentsPage } from '../../../src/support/Base/pageobjects/OrganizationDepartmentsPageObject';

// The "Add Tags" overlay (from CustomCommands.addTag) and the department Add/Edit form's own
// modal leave an active cdk-overlay-backdrop that intercepts every click. Press Escape until
// that backdrop is gone.
const dismissOpenDialog = async () => {
	const page = getPage();
	const backdrop = page.locator('.cdk-overlay-backdrop');
	for (let i = 0; i < 4; i++) {
		if ((await backdrop.count()) === 0) break;
		await page.keyboard.press('Escape');
		await page.waitForTimeout(600);
	}
};

const settleBeforeAdd = async () => {
	const page = getPage();
	await dismissOpenDialog();
	const toast = page.locator(OrganizationDepartmentsPage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast present */
	}
	await page.waitForTimeout(500);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addDepartmentButtonVisible = async () => {
	await settleBeforeAdd();
	await verifyElementIsVisible(OrganizationDepartmentsPage.addDepartmentButtonCss);
};

export const clickAddDepartmentButton = async () => {
	// Non-force click waits for the button to be stable/visible (route transition fade clears).
	await getPage().locator(OrganizationDepartmentsPage.addDepartmentButtonCss).first().click({ timeout: 60000 });
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationDepartmentsPage.nameInputCss);
	await enterInput(OrganizationDepartmentsPage.nameInputCss, data);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(OrganizationDepartmentsPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationDepartmentsPage.selectEmployeeDropdownOptionCss, index);
};

export const tagsDropdownVisible = async () => {
	// The department add form renders more than one #addTags ng-select; the LAST one is the
	// real, openable Tags field (the first does not open a panel).
	await getPage()
		.locator(OrganizationDepartmentsPage.addTagsDropdownCss)
		.last()
		.waitFor({ state: 'visible', timeout: 24000 });
};

export const clickTagsDropdown = async () => {
	await getPage().locator(OrganizationDepartmentsPage.addTagsDropdownCss).last().click({ force: true, timeout: 60000 });
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(OrganizationDepartmentsPage.tagsDropdownOption).first();
	await option.waitFor({ state: 'visible', timeout: 24000 });
	await option.click({ force: true });
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationDepartmentsPage.footerCss);
};

export const saveDepartmentButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.saveDepartmentButtonCss);
};

export const clickSaveDepartmentButton = async () => {
	await clickButton(OrganizationDepartmentsPage.saveDepartmentButtonCss);
};

export const tableRowVisible = async () => {
	// The Add/Edit form's modal backdrop can linger over the list and swallow the row click.
	await dismissOpenDialog();
	await getPage()
		.locator(OrganizationDepartmentsPage.selectTableRowCss)
		.first()
		.waitFor({ state: 'visible', timeout: 24000 });
};

export const selectTableRow = async () => {
	const page = getPage();
	await dismissOpenDialog();
	// Click the first cell (plain name text) — clicking the whole row can land on a link cell
	// (e.g. the employee avatar link) and navigate away instead of selecting.
	const cell = page.locator(OrganizationDepartmentsPage.selectTableRowCss).last().locator('td').first();
	const editBtn = page.locator(OrganizationDepartmentsPage.editDepartmentButtonCss).first();
	for (let i = 0; i < 3; i++) {
		if (await editBtn.isEnabled().catch(() => false)) return;
		await cell.click({ force: true });
		await page.waitForTimeout(800);
	}
};

// Select the specific department row by its (unique) name so edit/delete target exactly the
// department this run created, even when prior runs left similarly-named rows behind.
export const selectRowByText = async (text: string) => {
	const page = getPage();
	await dismissOpenDialog();
	const row = page
		.locator(OrganizationDepartmentsPage.selectTableRowCss)
		.filter({ hasText: text })
		.first();
	await row.waitFor({ state: 'visible', timeout: 24000 });
	// Click the first (name) cell — the whole-row click can hit a link cell and navigate away.
	const cell = row.locator('td').first();
	const editBtn = page.locator(OrganizationDepartmentsPage.editDepartmentButtonCss).first();
	for (let i = 0; i < 3; i++) {
		if (await editBtn.isEnabled().catch(() => false)) return;
		await cell.click({ force: true });
		await page.waitForTimeout(800);
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.deleteDepartmentButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(OrganizationDepartmentsPage.deleteDepartmentButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const verifyDepartmentExists = async (text: string) => {
	// Many cells match verifyDepartmentCss; target the one holding our department name.
	await getPage()
		.locator(OrganizationDepartmentsPage.verifyDepartmentCss, { hasText: text })
		.first()
		.waitFor({ state: 'visible', timeout: 24000 });
};

export const verifyDepartmentIsDeleted = async (text: string) => {
	// Only our (uniquely named) department cell should be gone; other rows may remain.
	await expect(
		getPage().locator(OrganizationDepartmentsPage.verifyDepartmentCss, { hasText: text })
	).toHaveCount(0, { timeout: 24000 });
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationDepartmentsPage.toastrMessageCss);
};
