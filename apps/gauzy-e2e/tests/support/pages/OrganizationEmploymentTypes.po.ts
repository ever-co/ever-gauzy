import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationEmploymentTypesPage } from '../../../src/support/Base/pageobjects/OrganizationEmploymentTypesPageObject';

// A modal dialog (Add Tags from CustomCommands.addTag, or the employment-type Add/Edit form
// whose Save sometimes does not auto-close) leaves an active cdk-overlay-backdrop that
// intercepts every click. Press Escape until that backdrop is gone.
const dismissOpenDialog = async () => {
	const page = getPage();
	const backdrop = page.locator('.cdk-overlay-backdrop');
	for (let i = 0; i < 4; i++) {
		if ((await backdrop.count()) === 0) break;
		await page.keyboard.press('Escape');
		await page.waitForTimeout(600);
	}
};

// The freshly-navigated page also renders a "Tag added" toast over a fading route transition,
// so the Add button is briefly not clickable. Dismiss any leftover dialog + wait for toasts
// to clear before opening the real form.
const settleBeforeAdd = async () => {
	const page = getPage();
	await dismissOpenDialog();
	const toast = page.locator(OrganizationEmploymentTypesPage.toastrMessageCss);
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

export const addButtonVisible = async () => {
	await settleBeforeAdd();
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// Non-force click waits for the button to be stable/visible (route transition fade clears).
	await getPage().locator(OrganizationEmploymentTypesPage.addButtonCss).first().click({ timeout: 60000 });
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clickButton(OrganizationEmploymentTypesPage.nameInputCss);
	await clearField(OrganizationEmploymentTypesPage.nameInputCss);
	await enterInput(OrganizationEmploymentTypesPage.nameInputCss, data);
};

export const editNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.editNameInputCss);
};

export const enterEditNameInputData = async (data: string) => {
	await clickButton(OrganizationEmploymentTypesPage.editNameInputCss);
	await clearField(OrganizationEmploymentTypesPage.editNameInputCss);
	await enterInput(OrganizationEmploymentTypesPage.editNameInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(OrganizationEmploymentTypesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEmploymentTypesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationEmploymentTypesPage.cardBodyCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const selectFirstItem = async () => {
	const page = getPage();
	// The Add/Edit dialog's Save sometimes leaves the modal backdrop up, which would
	// swallow the row click. Clear it first, then select the row.
	await dismissOpenDialog();
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.selectItemCss);
	const item = page.locator(OrganizationEmploymentTypesPage.selectItemCss).first();
	const editBtn = page.locator(OrganizationEmploymentTypesPage.editButtonCss).first();
	// Clicking a card toggles its selection. After add/save the row may already be selected,
	// so click only until the Edit action becomes enabled (selected state).
	for (let i = 0; i < 3; i++) {
		if (await editBtn.isEnabled().catch(() => false)) return;
		await item.click({ force: true });
		await page.waitForTimeout(800);
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	await clickButtonByIndex(OrganizationEmploymentTypesPage.editButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.deleteButtonCss);
};

export const clickDeleteButton = async (index: number) => {
	await clickButtonByIndex(OrganizationEmploymentTypesPage.deleteButtonCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationEmploymentTypesPage.toastrMessageCss);
};

export const verifyTypeExists = async (text: string) => {
	await verifyText(OrganizationEmploymentTypesPage.verifyTextCss, text);
};

export const verifyTypeIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationEmploymentTypesPage.verifyTextCss, text);
};
