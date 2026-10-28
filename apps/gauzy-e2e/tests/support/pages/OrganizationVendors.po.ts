import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	dispatchClickWhenSettled,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyText,
	waitElementToHide,
	verifyElementNotExist
} from '../util';
import { selectNgOption } from '../ng-select';
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

// Select the vendor row carrying `name` (enables Edit/Delete). By name, not "first row": the list also
// holds every other vendor created in this shard (e.g. the expenses scenario's "Domminos Pizza", and a
// retry's leftovers), so the first row is not necessarily the one this scenario added. The row click
// TOGGLES selection, so only re-click while Edit is still disabled.
export const selectItemByName = async (name: string) => {
	const page = getPage();
	await dismissOpenDialog();
	const item = page.locator(OrganizationVendorsPage.vendorRowCss).filter({ hasText: name }).first();
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
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(OrganizationVendorsPage.addTagsDropdownCss, OrganizationVendorsPage.tagsDropdownOption, index);
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

export const clickEditVendorButton = async (_index: number) => {
	// The selection actions slide in (~0.2 s) after the row click, so a coordinate click can land
	// mid-transition on the wrong button: dispatch it, and confirm the edit dialog's Name field opened.
	await dispatchClickWhenSettled(OrganizationVendorsPage.editVendorButtonCss, OrganizationVendorsPage.nameInputCss);
};

export const deleteVendorButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationVendorsPage.deleteVendorButtonCss);
};

export const clickDeleteVendorButton = async (_index: number) => {
	// Same slide-in hazard as Edit: dispatch, and confirm the delete-confirmation dialog opened.
	await dispatchClickWhenSettled(
		OrganizationVendorsPage.deleteVendorButtonCss,
		OrganizationVendorsPage.confirmDeleteButtonCss
	);
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
	// Target the NAME cell (div.ga-name-cell) of the row holding our vendor, rather than asserting on the
	// whole (multi-element) set of cells.
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
