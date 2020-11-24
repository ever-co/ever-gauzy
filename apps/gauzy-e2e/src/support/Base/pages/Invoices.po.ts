import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	clickButtonByText
} from '../utils/util';
import { InvoicesPage } from '../pageobjects/InvoicesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(InvoicesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(InvoicesPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(InvoicesPage.addButtonCss);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(InvoicesPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(InvoicesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(InvoicesPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(InvoicesPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(InvoicesPage.toastrMessageCss);
};

export const discountInputVisible = () => {
	verifyElementIsVisible(InvoicesPage.discountInputCss);
};

export const enterDiscountData = (data) => {
	clearField(InvoicesPage.discountInputCss);
	enterInput(InvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = () => {
	verifyElementIsVisible(InvoicesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = () => {
	clickButton(InvoicesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = (text) => {
	clickElementByText(InvoicesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = () => {
	verifyElementIsVisible(InvoicesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = () => {
	clickButton(InvoicesPage.organizationContactDropdownCss);
};

export const selectContactFromDropdwon = (index) => {
	clickButtonByIndex(InvoicesPage.contactOptionCss, index);
};

export const taxInputVisible = () => {
	verifyElementIsVisible(InvoicesPage.taxInputCss);
};

export const enterTaxData = (data) => {
	clearField(InvoicesPage.taxInputCss);
	enterInput(InvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = () => {
	verifyElementIsVisible(InvoicesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = () => {
	clickButton(InvoicesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = (text) => {
	clickElementByText(InvoicesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = () => {
	verifyElementIsVisible(InvoicesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = () => {
	clickButton(InvoicesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = (text) => {
	clickElementByText(InvoicesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(InvoicesPage.selectEmloyeeCss);
};
export const clickEmployeeDropdown = () => {
	clickButton(InvoicesPage.selectEmloyeeCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(InvoicesPage.dropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = () => {
	clickButton(InvoicesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = (text) => {
	clickButtonByText(text);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(InvoicesPage.tableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(InvoicesPage.tableRowCss, index);
};

export const actionButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.infoButtonCss);
};

export const clickActionButtonByText = (text) => {
	clickElementByText(InvoicesPage.infoButtonCss, text);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(InvoicesPage.backButtonCss);
};

export const confirmButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.confirmButtonCss);
};

export const clickConfirmButton = () => {
	clickButton(InvoicesPage.confirmButtonCss);
};

export const emailInputVisible = () => {
	verifyElementIsVisible(InvoicesPage.emailInputCss);
};

export const enterEmailData = (data) => {
	enterInput(InvoicesPage.emailInputCss, data);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.editButtonCss);
};

export const clickEditButton = (text) => {
	clickElementByText(InvoicesPage.editButtonCss, text);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(InvoicesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(InvoicesPage.confirmDeleteButtonCss);
};

export const setStatusButtonVisible = () => {
	verifyElementIsVisible(InvoicesPage.setStatusButtonCss);
};

export const clickSetStatusButton = (text) => {
	clickElementByText(InvoicesPage.setStatusButtonCss, text);
};

export const setStatusFromDropdown = (text) => {
	clickElementByText(InvoicesPage.dropdownOptionCss, text);
};
