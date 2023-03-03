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
} from '../utils/util';
import { EstimatesPage } from '../pageobjects/EstimatesPageObject';

export const gridBtnExists = () => {
	cy.intercept('GET', '/api/invoices/*').as('waitUserOrganization');
	cy.wait('@waitUserOrganization');
	verifyElementIsVisible(EstimatesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(EstimatesPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(EstimatesPage.addButtonCss);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(EstimatesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	clickButton(EstimatesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(EstimatesPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(EstimatesPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(EstimatesPage.toastrMessageCss);
};

export const discountInputVisible = () => {
	verifyElementIsVisible(EstimatesPage.discountInputCss);
};

export const enterDiscountData = (data) => {
	clearField(EstimatesPage.discountInputCss);
	enterInput(EstimatesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = () => {
	verifyElementIsVisible(EstimatesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = () => {
	clickButton(EstimatesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = (text) => {
	clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = () => {
	verifyElementIsVisible(EstimatesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = () => {
	clickButton(EstimatesPage.organizationContactDropdownCss);
};

export const selectContactFromDropdown = (index) => {
	clickButtonByIndex(EstimatesPage.contactOptionCss, index);
};

export const taxInputVisible = () => {
	verifyElementIsVisible(EstimatesPage.taxInputCss);
};

export const enterTaxData = (data) => {
	clearField(EstimatesPage.taxInputCss);
	enterInput(EstimatesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = () => {
	verifyElementIsVisible(EstimatesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = () => {
	clickButton(EstimatesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = (text) => {
	clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = () => {
	verifyElementIsVisible(EstimatesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = () => {
	clickButton(EstimatesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = (text) => {
	clickElementByText(EstimatesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(EstimatesPage.selectEmployeeCss);
};
export const clickEmployeeDropdown = () => {
	clickButton(EstimatesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(EstimatesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = () => {
	clickButton(EstimatesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = (text) => {
	clickButtonByText(text);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(EstimatesPage.tableRowCss);
};

export const selectTableRow = (index) => {
	waitUntil(3000);
	clickButtonByIndex(EstimatesPage.tableRowCss, index);
};

export const actionButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.popoverButtonCss);
};

export const clickActionButtonByText = (text) => {
	clickElementByText(EstimatesPage.popoverButtonCss, text);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.backButtonCss);
};

export const clickBackButton = () => {
	cy.intercept('GET', '/api/invoices/pagination*').as('waitTable');
	clickButton(EstimatesPage.backButtonCss);
	cy.wait('@waitTable');
};

export const confirmButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.confirmButtonCss);
};

export const clickConfirmButton = () => {
	clickButton(EstimatesPage.confirmButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(EstimatesPage.emailInputCss);
};

export const enterEmailData = (data) => {
	enterInput(EstimatesPage.emailInputCss, data);
};

export const convertToInvoiceButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.convertToInvoiceButton);
};

export const clickConvertToInvoiceButton = (index) => {
	clickButtonByIndex(EstimatesPage.convertToInvoiceButton, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(EstimatesPage.editButtonCss, index);
};

export const viewButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.viewButtonCss);
};

export const clickViewButton = (index) => {
	clickButtonByIndex(EstimatesPage.viewButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(EstimatesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(EstimatesPage.confirmDeleteButtonCss);
};

export const verifyEstimateExists = (val) => {
	verifyValue(EstimatesPage.verifyEstimateCss, val);
};

export const verifyDraftBadgeClass = () => {
	verifyElementIsVisible(EstimatesPage.draftBadgeCss);
};

export const verifySentBadgeClass = () => {
	verifyElementIsVisible(EstimatesPage.successBadgeCss);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(EstimatesPage.verifyEstimateCss, text);
};

export const scrollEmailInviteTemplate = () => {
	scrollDown(EstimatesPage.emailCardCss);
};

export const moreButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.moreButtonCss);
};

export const clickMoreButton = () => {
	clickButton(EstimatesPage.moreButtonCss);
};

export const verifyTabButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.tabButtonCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(EstimatesPage.tabButtonCss, index);
};

export const verifyEstimateNumberInputVisible = () => {
	verifyElementIsVisible(EstimatesPage.inputInvoiceNumberCss);
};

export const enterEstimateNumberInputData = (data) => {
	clearField(EstimatesPage.inputInvoiceNumberCss);
	enterInput(EstimatesPage.inputInvoiceNumberCss, data);
};

export const verifyEstimateDateInput = () => {
	verifyElementIsVisible(EstimatesPage.estimateDateCss);
};

export const verifyEstimateDueDateInput = () => {
	verifyElementIsVisible(EstimatesPage.dueDateInputCss);
};

export const verifyTotalValueInputVisible = () => {
	verifyElementIsVisible(EstimatesPage.totalValueInputCss);
};

export const verifyCurrencyDropdownVisible = () => {
	verifyElementIsVisible(EstimatesPage.currencySelectCss);
};

export const verifyStatusInputVisible = () => {
	verifyElementIsVisible(EstimatesPage.inputStatusCss);
};

export const searchButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.searchButtonCss);
};

export const clickSearchButton = () => {
	clickButton(EstimatesPage.searchButtonCss);
};

export const verifyDraftBadgeNotVisible = () => {
	verifyElementIsNotVisible(EstimatesPage.draftBadgeCss);
};

export const resetButtonVisible = () => {
	verifyElementIsVisible(EstimatesPage.resetButtonCss);
};

export const clickResetButton = () => {
	clickButton(EstimatesPage.resetButtonCss);
};

export const verifyMoreButton = () => {
	verifyElementIsVisible(EstimatesPage.moreButtonCss);
};
