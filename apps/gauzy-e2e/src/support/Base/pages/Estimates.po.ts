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
import { EstimatesPage } from '../pageobjects/EstimatesPageObject';

export const gridBtnExists = () => {
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

export const clickTagsDropdwon = () => {
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

export const selectContactFromDropdwon = (index) => {
	clickButtonByIndex(EstimatesPage.contactOptionCss, index);
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
	verifyElementIsVisible(EstimatesPage.selectEmloyeeCss);
};
export const clickEmployeeDropdown = () => {
	clickButton(EstimatesPage.selectEmloyeeCss);
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
	clickButtonByIndex(EstimatesPage.tableRowCss, index);
};
