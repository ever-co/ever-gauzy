import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	clickButtonByText,
	verifyValue,
	scrollDown,
	verifyText,
	clickButtonWithDelay
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SalesInvoicesPage } from '../../../src/support/Base/pageobjects/SalesInvoicesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(SalesInvoicesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(SalesInvoicesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(SalesInvoicesPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(SalesInvoicesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.discountInputCss);
};

export const enterDiscountData = async (data: string) => {
	await clearField(SalesInvoicesPage.discountInputCss);
	await enterInput(SalesInvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(SalesInvoicesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	await clickButton(SalesInvoicesPage.organizationContactDropdownCss);
};

export const selectContactFromDropdown = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.contactOptionCss, index);
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.taxInputCss);
};

export const enterTaxData = async (data: string) => {
	await clearField(SalesInvoicesPage.taxInputCss);
	await enterInput(SalesInvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(SalesInvoicesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.selectEmployeeCss);
};
export const clickEmployeeDropdown = async () => {
	await clickButton(SalesInvoicesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	await clickButton(SalesInvoicesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text: string) => {
	await clickButtonByText(text);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.tableRowCss);
};

export const selectTableRow = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.tableRowCss, index);
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.popoverButtonCss, text);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(SalesInvoicesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	await clickButtonWithDelay(SalesInvoicesPage.confirmButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await enterInput(SalesInvoicesPage.emailInputCss, data);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.editButtonCss, index);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.viewButtonCss);
};

export const clickViewButton = async (index: number) => {
	await clickButtonByIndex(SalesInvoicesPage.viewButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(SalesInvoicesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const setStatusButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.setStatusButtonCss);
};

export const clickSetStatusButton = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.setStatusButtonCss, text);
};

export const setStatusFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const verifyEstimateExists = async (val: string) => {
	await verifyValue(SalesInvoicesPage.verifyInvoiceCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyText(SalesInvoicesPage.verifyInvoiceCss, text);
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(SalesInvoicesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	await clickButton(SalesInvoicesPage.moreButtonCss);
};

export const verifyMoreButton = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.moreButtonCss);
};
