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
	scrollDown
} from '../utils/util';
import { SalesEstimatesPage } from '../pageobjects/SalesEstimatesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(SalesEstimatesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(SalesEstimatesPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(SalesEstimatesPage.addButtonCss);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(SalesEstimatesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(SalesEstimatesPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(SalesEstimatesPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(SalesEstimatesPage.toastrMessageCss);
};

export const discountInputVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.discountInputCss);
};

export const enterDiscountData = (data) => {
	clearField(SalesEstimatesPage.discountInputCss);
	enterInput(SalesEstimatesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = () => {
	clickButton(SalesEstimatesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = (text) => {
	clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = () => {
	clickButton(SalesEstimatesPage.organizationContactDropdownCss);
};

export const selectContactFromDropdwon = (index) => {
	clickButtonByIndex(SalesEstimatesPage.contactOptionCss, index);
};

export const taxInputVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.taxInputCss);
};

export const enterTaxData = (data) => {
	clearField(SalesEstimatesPage.taxInputCss);
	enterInput(SalesEstimatesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = () => {
	clickButton(SalesEstimatesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = (text) => {
	clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = () => {
	clickButton(SalesEstimatesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = (text) => {
	clickElementByText(SalesEstimatesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.selectEmloyeeCss);
};
export const clickEmployeeDropdown = () => {
	clickButton(SalesEstimatesPage.selectEmloyeeCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(SalesEstimatesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = () => {
	clickButton(SalesEstimatesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = (text) => {
	clickButtonByText(text);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.tableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(SalesEstimatesPage.tableRowCss, index);
};

export const actionButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.popoverButtonCss);
};

export const clickActionButtonByText = (text) => {
	clickElementByText(SalesEstimatesPage.popoverButtonCss, text);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(SalesEstimatesPage.backButtonCss);
};

export const confirmButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.confirmButtonCss);
};

export const clickConfirmButton = () => {
	clickButton(SalesEstimatesPage.confirmButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.emailInputCss);
};

export const enterEmailData = (data) => {
	enterInput(SalesEstimatesPage.emailInputCss, data);
};

export const convertToInvoiceButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.convertToInvoiceButton);
};

export const clickConvertToInvoiceButton = (index) => {
	clickButtonByIndex(SalesEstimatesPage.convertToInvoiceButton, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(SalesEstimatesPage.editButtonCss, index);
};

export const viewButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.viewButtonCss);
};

export const clickViewButton = (index) => {
	clickButtonByIndex(SalesEstimatesPage.viewButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(SalesEstimatesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(SalesEstimatesPage.confirmDeleteButtonCss);
};

export const verifyEstimateExists = (val) => {
	verifyValue(SalesEstimatesPage.verifyEstimateCss, val);
};

export const verifyDraftBadgeClass = () => {
	verifyElementIsVisible(SalesEstimatesPage.draftBadgeCss);
};

export const verifySentBadgeClass = () => {
	verifyElementIsVisible(SalesEstimatesPage.successBadgeCss);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(SalesEstimatesPage.verifyEstimateCss, text);
};

export const scrollEmailInviteTemplate = () => {
	scrollDown(SalesEstimatesPage.emailCardCss);
};

export const moreButtonVisible = () => {
	verifyElementIsVisible(SalesEstimatesPage.moreButtonCss);
};

export const clickMoreButton = () => {
	clickButton(SalesEstimatesPage.moreButtonCss);
};
