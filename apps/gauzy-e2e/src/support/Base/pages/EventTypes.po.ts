import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide
} from '../utils/util';
import { EventTypesPage } from '../pageobjects/EventTypesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(EventTypesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(EventTypesPage.gridButtonCss, index);
};

export const addEventTypeButtonVisible = () => {
	verifyElementIsVisible(EventTypesPage.addEventTypeButtonCss);
};

export const clickAddEventTypeButton = () => {
	clickButton(EventTypesPage.addEventTypeButtonCss);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(EventTypesPage.selectEmployeeDrodownCss);
};

export const clickSelectEmployeeDropdown = () => {
	cy.wait(3000);
	clickButton(EventTypesPage.selectEmployeeDrodownCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(EventTypesPage.selectEmployeeDropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const titleInputVisible = () => {
	verifyElementIsVisible(EventTypesPage.titleInputCss);
};

export const enterTitleInputData = (data) => {
	clearField(EventTypesPage.titleInputCss);
	enterInput(EventTypesPage.titleInputCss, data);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(EventTypesPage.descriptionInputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(EventTypesPage.descriptionInputCss);
	enterInput(EventTypesPage.descriptionInputCss, data);
};

export const durationInputVisible = () => {
	verifyElementIsVisible(EventTypesPage.durationInputCss);
};

export const enterDurationInputData = (data) => {
	clearField(EventTypesPage.durationInputCss);
	enterInput(EventTypesPage.durationInputCss, data);
};

export const checkboxVisible = () => {
	verifyElementIsVisible(EventTypesPage.activeCheckboxCss);
};

export const clickCheckbox = () => {
	clickButton(EventTypesPage.activeCheckboxCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(EventTypesPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(EventTypesPage.saveButtonCss);
};

export const selectTableRowVisible = () => {
	verifyElementIsVisible(EventTypesPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(EventTypesPage.selectTableRowCss, index);
};

export const editEventTypeButtonVisible = () => {
	verifyElementIsVisible(EventTypesPage.editEventTypeButtonCss);
};

export const clickEditEventTypeButton = () => {
	clickButton(EventTypesPage.editEventTypeButtonCss);
};

export const deleteEventTypeButtonVisible = () => {
	verifyElementIsVisible(EventTypesPage.deleteEventTypeButtonCss);
};

export const clickDeleteEventTypeButton = () => {
	clickButton(EventTypesPage.deleteEventTypeButtonCss);
};

export const confirmDeleteEventTypeButtonVisible = () => {
	verifyElementIsVisible(EventTypesPage.confirmDeleteEventTypeButtonCss);
};

export const clickConfirmDeleteEventTypeButton = () => {
	clickButton(EventTypesPage.confirmDeleteEventTypeButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(EventTypesPage.toastrMessageCss);
};
