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
	verifyText
} from '../utils/util';
import { SalesInvoicesPage } from '../pageobjects/SalesInvoicesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(SalesInvoicesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(SalesInvoicesPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(SalesInvoicesPage.addButtonCss);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(SalesInvoicesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(SalesInvoicesPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(SalesInvoicesPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(SalesInvoicesPage.toastrMessageCss);
};

export const discountInputVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.discountInputCss);
};

export const enterDiscountData = (data) => {
	clearField(SalesInvoicesPage.discountInputCss);
	enterInput(SalesInvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = () => {
	clickButton(SalesInvoicesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = (text) => {
	clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = () => {
	clickButton(SalesInvoicesPage.organizationContactDropdownCss);
};

export const selectContactFromDropdwon = (index) => {
	clickButtonByIndex(SalesInvoicesPage.contactOptionCss, index);
};

export const taxInputVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.taxInputCss);
};

export const enterTaxData = (data) => {
	clearField(SalesInvoicesPage.taxInputCss);
	enterInput(SalesInvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = () => {
	clickButton(SalesInvoicesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = (text) => {
	clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = () => {
	clickButton(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = (text) => {
	clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.selectEmloyeeCss);
};
export const clickEmployeeDropdown = () => {
	clickButton(SalesInvoicesPage.selectEmloyeeCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(SalesInvoicesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = () => {
	clickButton(SalesInvoicesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = (text) => {
	clickButtonByText(text);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.tableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(SalesInvoicesPage.tableRowCss, index);
};

export const actionButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.popoverButtonCss);
};

export const clickActionButtonByText = (text) => {
	clickElementByText(SalesInvoicesPage.popoverButtonCss, text);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(SalesInvoicesPage.backButtonCss);
};

export const confirmButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.confirmButtonCss);
};

export const clickConfirmButton = () => {
	clickButton(SalesInvoicesPage.confirmButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.emailInputCss);
};

export const enterEmailData = (data) => {
	enterInput(SalesInvoicesPage.emailInputCss, data);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(SalesInvoicesPage.editButtonCss, index);
};

export const viewButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.viewButtonCss);
};

export const clickViewButton = (index) => {
	clickButtonByIndex(SalesInvoicesPage.viewButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(SalesInvoicesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const setStatusButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.setStatusButtonCss);
};

export const clickSetStatusButton = (text) => {
	clickElementByText(SalesInvoicesPage.setStatusButtonCss, text);
};

export const setStatusFromDropdown = (text) => {
	clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const verifyEstimateExists = (val) => {
	verifyValue(SalesInvoicesPage.verifyInvoiceCss, val);
};

export const verifyDraftBadgeClass = () => {
	verifyElementIsVisible(SalesInvoicesPage.draftBadgeCss);
};

export const verifySentBadgeClass = () => {
	verifyElementIsVisible(SalesInvoicesPage.successBadgeCss);
};

export const verifyElementIsDeleted = (text) => {
	verifyText(SalesInvoicesPage.verifyInvoiceCss, text);
};

export const scrollEmailInviteTemplate = () => {
	scrollDown(SalesInvoicesPage.emailCardCss);
};

export const moreButtonVisible = () => {
	verifyElementIsVisible(SalesInvoicesPage.moreButtonCss);
};

export const clickMoreButton = () => {
	clickButton(SalesInvoicesPage.moreButtonCss);
};
