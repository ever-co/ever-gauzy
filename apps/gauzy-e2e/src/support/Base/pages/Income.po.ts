import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../utils/util';
import { IncomePage } from '../pageobjects/IncomePageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(IncomePage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(IncomePage.gridButtonCss, index);
};

export const addIncomeButtonVisible = () => {
	verifyElementIsVisible(IncomePage.addIncomeButtonCss);
};

export const clickAddIncomeButton = () => {
	clickButton(IncomePage.addIncomeButtonCss);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(IncomePage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(IncomePage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDrodpwon = (index) => {
	clickButtonByIndex(IncomePage.selectEmployeeDropdownOptionCss, index);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(IncomePage.dateInputCss);
};

export const enterDateInputData = () => {
	clearField(IncomePage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(IncomePage.dateInputCss, date);
};

export const contactInputVisible = () => {
	verifyElementIsVisible(IncomePage.organizationContactCss);
};

export const clickContactInput = () => {
	clickButton(IncomePage.organizationContactCss);
};

export const enterContactInputData = (data) => {
	enterInputConditionally(IncomePage.organizationContactCss, data);
};

export const amountInputVisible = () => {
	verifyElementIsVisible(IncomePage.amountInputCss);
};

export const enterAmountInputData = (data) => {
	clearField(IncomePage.amountInputCss);
	enterInput(IncomePage.amountInputCss, data);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(IncomePage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(IncomePage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(IncomePage.tagsDropdownOption, index);
};

export const notesTextareaVisible = () => {
	verifyElementIsVisible(IncomePage.notesInputCss);
};

export const enterNotesInputData = (data) => {
	clearField(IncomePage.notesInputCss);
	enterInput(IncomePage.notesInputCss, data);
};

export const saveIncomeButtonVisible = () => {
	verifyElementIsVisible(IncomePage.saveIncomeButtonCss);
};

export const clickSaveIncomeButton = () => {
	clickButton(IncomePage.saveIncomeButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(IncomePage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(IncomePage.selectTableRowCss, index);
};

export const editIncomeButtonVisible = () => {
	verifyElementIsVisible(IncomePage.editIncomeButtonCss);
};

export const clickEditIncomeButton = () => {
	clickButton(IncomePage.editIncomeButtonCss);
};

export const deleteIncomeButtonVisible = () => {
	verifyElementIsVisible(IncomePage.deleteIncomeButtonCss);
};

export const clickDeleteIncomeButton = () => {
	clickButton(IncomePage.deleteIncomeButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(IncomePage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(IncomePage.confirmDeleteButtonCss);
};

export const clickCardBody = () => {
	clickButton(IncomePage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(IncomePage.toastrMessageCss);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(IncomePage.verifyIncomeCss, text);
};

export const verifyIncomeExists = (text) => {
	verifyText(IncomePage.verifyIncomeCss, text);
};
