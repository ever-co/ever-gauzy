import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickElementByText,
	clickKeyboardBtnByKeycode,
	waitElementToHide
} from '../utils/util';
import { PaymentsPage } from '../pageobjects/PaymentsPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(PaymentsPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(PaymentsPage.gridButtonCss, index);
};

export const addPaymentButtonVisible = () => {
	verifyElementIsVisible(PaymentsPage.addPaymentButtonCss);
};

export const clickAddPaymentButton = () => {
	clickButton(PaymentsPage.addPaymentButtonCss);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(PaymentsPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(PaymentsPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(PaymentsPage.tagsDropdownOption, index);
};

export const projectDropdownVisible = () => {
	verifyElementIsVisible(PaymentsPage.projectDropdownCss);
};

export const clickProjectDropdown = () => {
	clickButton(PaymentsPage.projectDropdownCss);
};

export const selectProjectFromDropdown = (text) => {
	clickElementByText(PaymentsPage.projectDropdownOptionCss, text);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(PaymentsPage.dateInputCss);
};

export const enterDateInputData = () => {
	clearField(PaymentsPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(PaymentsPage.dateInputCss, date);
};

export const paymentMethodDropdownVisible = () => {
	verifyElementIsVisible(PaymentsPage.paymentMethodDropdownCss);
};

export const clickPaymentMethodDropdown = () => {
	clickButton(PaymentsPage.paymentMethodDropdownCss);
};

export const selectPaymentMethod = (text) => {
	clickElementByText(PaymentsPage.paymentMethodDropdownOptionCss, text);
};

export const amountInputVisible = () => {
	verifyElementIsVisible(PaymentsPage.amountInputCss);
};

export const enterAmountInputData = (data) => {
	clearField(PaymentsPage.amountInputCss);
	enterInput(PaymentsPage.amountInputCss, data);
};

export const noteTextareaVisible = () => {
	verifyElementIsVisible(PaymentsPage.noteInputCss);
};

export const enterNoteInputData = (data) => {
	clearField(PaymentsPage.noteInputCss);
	enterInput(PaymentsPage.noteInputCss, data);
};

export const savePaymentButtonVisible = () => {
	verifyElementIsVisible(PaymentsPage.saveExpenseButtonCss);
};

export const clickSavePaymentButton = () => {
	clickButton(PaymentsPage.saveExpenseButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(PaymentsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(PaymentsPage.selectTableRowCss, index);
};

export const editPaymentButtonVisible = () => {
	verifyElementIsVisible(PaymentsPage.editPaymentButtonCss);
};

export const clickEditPaymentButton = () => {
	clickButton(PaymentsPage.editPaymentButtonCss);
};

export const deletePaymentButtonVisible = () => {
	verifyElementIsVisible(PaymentsPage.deletePaymentButtonCss);
};

export const clickDeletePaymentButton = () => {
	clickButton(PaymentsPage.deletePaymentButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(PaymentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(PaymentsPage.confirmDeleteButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = () => {
	clickButton(PaymentsPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(PaymentsPage.toastrMessageCss);
};
