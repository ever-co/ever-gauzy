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
	verifyTextNotExisting,
	scrollDown,
	verifyElementIsNotVisible,
	waitUntil
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EstimatesPage } from '../../../src/support/Base/pageobjects/EstimatesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(EstimatesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(EstimatesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(EstimatesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(EstimatesPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EstimatesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.discountInputCss);
};

export const enterDiscountData = async (data) => {
	await clearField(EstimatesPage.discountInputCss);
	await enterInput(EstimatesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(EstimatesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text) => {
	await clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	await clickButton(EstimatesPage.organizationContactDropdownCss);
};

export const selectContactFromDropdown = async (index) => {
	await clickButtonByIndex(EstimatesPage.contactOptionCss, index);
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.taxInputCss);
};

export const enterTaxData = async (data) => {
	await clearField(EstimatesPage.taxInputCss);
	await enterInput(EstimatesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(EstimatesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text) => {
	await clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(EstimatesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text) => {
	await clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.selectEmployeeCss);
};

export const clickEmployeeDropdown = async () => {
	await clickButton(EstimatesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(EstimatesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	await clickButton(EstimatesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text) => {
	await clickButtonByText(text);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.tableRowCss);
};

export const selectTableRow = async (index) => {
	await waitUntil(3000);
	await clickButtonByIndex(EstimatesPage.tableRowCss, index);
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text) => {
	await clickElementByText(EstimatesPage.popoverButtonCss, text);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(EstimatesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	await clickButton(EstimatesPage.confirmButtonCss);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.emailInputCss);
};

export const enterEmailData = async (data) => {
	await enterInput(EstimatesPage.emailInputCss, data);
};

export const convertToInvoiceButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.convertToInvoiceButton);
};

export const clickConvertToInvoiceButton = async (index) => {
	await clickButtonByIndex(EstimatesPage.convertToInvoiceButton, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.editButtonCss);
};

export const clickEditButton = async (index) => {
	await clickButtonByIndex(EstimatesPage.editButtonCss, index);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.viewButtonCss);
};

export const clickViewButton = async (index) => {
	await clickButtonByIndex(EstimatesPage.viewButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(EstimatesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(EstimatesPage.confirmDeleteButtonCss);
};

export const verifyEstimateExists = async (val) => {
	await verifyValue(EstimatesPage.verifyEstimateCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(EstimatesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(EstimatesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text) => {
	await verifyTextNotExisting(EstimatesPage.verifyEstimateCss, text);
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(EstimatesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	await clickButton(EstimatesPage.moreButtonCss);
};

export const verifyTabButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.tabButtonCss);
};

export const clickTabButton = async (index) => {
	await clickButtonByIndex(EstimatesPage.tabButtonCss, index);
};

export const verifyEstimateNumberInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.inputInvoiceNumberCss);
};

export const enterEstimateNumberInputData = async (data) => {
	await clearField(EstimatesPage.inputInvoiceNumberCss);
	await enterInput(EstimatesPage.inputInvoiceNumberCss, data);
};

export const verifyEstimateDateInput = async () => {
	await verifyElementIsVisible(EstimatesPage.estimateDateCss);
};

export const verifyEstimateDueDateInput = async () => {
	await verifyElementIsVisible(EstimatesPage.dueDateInputCss);
};

export const verifyTotalValueInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.totalValueInputCss);
};

export const verifyCurrencyDropdownVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.currencySelectCss);
};

export const verifyStatusInputVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.inputStatusCss);
};

export const searchButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.searchButtonCss);
};

export const clickSearchButton = async () => {
	await clickButton(EstimatesPage.searchButtonCss);
};

export const verifyDraftBadgeNotVisible = async () => {
	await verifyElementIsNotVisible(EstimatesPage.draftBadgeCss);
};

export const resetButtonVisible = async () => {
	await verifyElementIsVisible(EstimatesPage.resetButtonCss);
};

export const clickResetButton = async () => {
	await clickButton(EstimatesPage.resetButtonCss);
};

export const verifyMoreButton = async () => {
	await verifyElementIsVisible(EstimatesPage.moreButtonCss);
};
