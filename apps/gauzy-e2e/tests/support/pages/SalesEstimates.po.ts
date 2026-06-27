import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	dispatchClick,
	waitForSpinnerGone,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	clickButtonByText,
	verifyValue,
	verifyTextNotExisting,
	scrollDown,
	waitUntil
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SalesEstimatesPage } from '../../../src/support/Base/pageobjects/SalesEstimatesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// dispatchClick past the post-navigation/mutation load spinner so the Add estimate form reliably
	// opens; a coordinate click can land on the spinner/backdrop instead.
	await waitForSpinnerGone();
	await dispatchClick(SalesEstimatesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// focus + ArrowDown (NOT a click): #addTags is an ng-select that opens on mousedown, so a force-click
	// lands on the add-form backdrop and dismisses the route form; keyboard opens the panel without that.
	// The focus MUST target the inner <input> — focusing the ng-select host leaves the input unfocused so
	// ArrowDown goes to <body> and the panel never opens (the div.ng-option timeout seen in this suite).
	await waitForSpinnerGone();
	await getPage().locator(`${SalesEstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard (focus inner input + ArrowDown) until the options render —
	// ng-select opens on mousedown so a click is backdrop-blocked. Then pick the option (appended to body).
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${SalesEstimatesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(SalesEstimatesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(SalesEstimatesPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(SalesEstimatesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.discountInputCss);
};

export const enterDiscountData = async (data: string) => {
	await clearField(SalesEstimatesPage.discountInputCss);
	await enterInput(SalesEstimatesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(SalesEstimatesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on mousedown, options appendTo body) — same hazard as the
	// tags one: a force-click is backdrop-blocked / can dismiss the route form. Open via the inner input.
	await waitForSpinnerGone();
	await getPage().locator(`${SalesEstimatesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectContactFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesEstimatesPage.contactOptionCss);
	// Re-open the contact ng-select via keyboard until its options render, then pick one.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${SalesEstimatesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	await clickButtonByIndex(SalesEstimatesPage.contactOptionCss, index);
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.taxInputCss);
};

export const enterTaxData = async (data: string) => {
	await clearField(SalesEstimatesPage.taxInputCss);
	await enterInput(SalesEstimatesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(SalesEstimatesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.selectEmployeeCss);
};
export const clickEmployeeDropdown = async () => {
	await clickButton(SalesEstimatesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(SalesEstimatesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	await clickButton(SalesEstimatesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text: string) => {
	await clickButtonByText(text);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.tableRowCss);
};

export const selectTableRow = async (index: number) => {
	// Settle the grid (it re-renders after each mutation) before the single row click; the click toggles
	// selection, so clicking too early/twice can leave the toolbar Edit/View/Delete disabled.
	await waitForSpinnerGone();
	await waitUntil(3000);
	await clickButtonByIndex(SalesEstimatesPage.tableRowCss, index);
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text: string) => {
	await clickElementByText(SalesEstimatesPage.popoverButtonCss, text);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(SalesEstimatesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	await clickButton(SalesEstimatesPage.confirmButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await enterInput(SalesEstimatesPage.emailInputCss, data);
};

export const convertToInvoiceButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.convertToInvoiceButton);
};

export const clickConvertToInvoiceButton = async (index: number) => {
	await clickButtonByIndex(SalesEstimatesPage.convertToInvoiceButton, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	await clickButtonByIndex(SalesEstimatesPage.editButtonCss, index);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.viewButtonCss);
};

export const clickViewButton = async (index: number) => {
	await clickButtonByIndex(SalesEstimatesPage.viewButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(SalesEstimatesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const verifyEstimateExists = async (val: string) => {
	await verifyValue(SalesEstimatesPage.verifyEstimateCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(SalesEstimatesPage.verifyEstimateCss, text);
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(SalesEstimatesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(SalesEstimatesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	await clickButton(SalesEstimatesPage.moreButtonCss);
};
