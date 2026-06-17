import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyText,
	waitElementToHide,
	verifyElementNotExist
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationVendorsPage } from '../../../src/support/Base/pageobjects/OrganizationVendorsPageObject';

// A modal dialog (Add Tags from CustomCommands.addTag, or the vendor Add/Edit form whose Save
// can briefly leave the backdrop up) leaves an active cdk-overlay-backdrop that intercepts
// every click. Press Escape until that backdrop is gone.
const dismissOpenDialog = async () => {
	const page = getPage();
	const backdrop = page.locator('.cdk-overlay-backdrop');
	for (let i = 0; i < 4; i++) {
		if ((await backdrop.count()) === 0) break;
		await page.keyboard.press('Escape');
		await page.waitForTimeout(600);
	}
};

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addVendorButtonVisible = async () => {
	await dismissOpenDialog();
	const page = getPage();
	const toast = page.locator(OrganizationVendorsPage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast present */
	}
	await page.waitForTimeout(500);
	await verifyElementIsVisible(OrganizationVendorsPage.addVendorButtonCss);
};

export const clickAddVendorButton = async () => {
	// Non-force click waits for the button to be stable/visible (route transition fade clears).
	await getPage().locator(OrganizationVendorsPage.addVendorButtonCss).first().click({ timeout: 60000 });
};

// The vendor list is a grid of rows; a row must be selected to enable the Edit/Delete actions.
export const selectFirstItem = async () => {
	const page = getPage();
	await dismissOpenDialog();
	const item = page.locator(OrganizationVendorsPage.selectItemCss).first();
	await item.waitFor({ state: 'visible', timeout: 24000 });
	const editBtn = page.locator(OrganizationVendorsPage.editVendorButtonCss).first();
	for (let i = 0; i < 3; i++) {
		if (await editBtn.isEnabled().catch(() => false)) return;
		await item.click({ force: true });
		await page.waitForTimeout(800);
	}
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.nameInputCss);
	await enterInput(OrganizationVendorsPage.nameInputCss, data);
};

export const phoneInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.phoneInputCss);
};

export const enterPhoneInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.phoneInputCss);
	await enterInput(OrganizationVendorsPage.phoneInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.emailInputCss);
};

export const enterEmailInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.emailInputCss);
	await enterInput(OrganizationVendorsPage.emailInputCss, data);
};

export const websiteInputVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.websiteInputCss);
};

export const enterWebsiteInputData = async (data: string) => {
	await clearField(OrganizationVendorsPage.websiteInputCss);
	await enterInput(OrganizationVendorsPage.websiteInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(OrganizationVendorsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationVendorsPage.tagsDropdownOption, index);
};

export const saveVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.saveVendorButtonCss);
};

export const clickSaveVendorButton = async () => {
	await clickButton(OrganizationVendorsPage.saveVendorButtonCss);
};

export const editVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.editVendorButtonCss);
};

export const clickEditVendorButton = async (index: number) => {
	await clickButtonByIndex(OrganizationVendorsPage.editVendorButtonCss, index);
};

export const deleteVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.deleteVendorButtonCss);
};

export const clickDeleteVendorButton = async (index: number) => {
	await clickButtonByIndex(OrganizationVendorsPage.deleteVendorButtonCss, index);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationVendorsPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationVendorsPage.toastrMessageCss);
};

export const verifyVendorExists = async (text: string) => {
	// The vendor list renders many text-truncate cells (one per column per vendor); target the
	// specific cell holding our vendor name rather than asserting on the whole (multi-element) set.
	await getPage()
		.locator(OrganizationVendorsPage.verifyVendorCss, { hasText: text })
		.first()
		.waitFor({ state: 'visible', timeout: 24000 });
};

export const verifyVendorIsDeleted = async (text?: string) => {
	if (text) {
		// Other vendors may remain in the shared DB; only assert OUR vendor cell is gone.
		await getPage()
			.locator(OrganizationVendorsPage.verifyVendorCss, { hasText: text })
			.waitFor({ state: 'detached', timeout: 24000 });
		return;
	}
	await verifyElementNotExist(OrganizationVendorsPage.verifyVendorCss);
};
