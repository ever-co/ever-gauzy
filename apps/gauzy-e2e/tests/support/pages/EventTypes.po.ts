import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	waitUntil
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EventTypesPage } from '../../../src/support/Base/pageobjects/EventTypesPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(EventTypesPage.gridButtonCss);
};

export const gridBtnClick = async (index) => {
	await clickButtonByIndex(EventTypesPage.gridButtonCss, index);
};

export const addEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.addEventTypeButtonCss);
};

export const clickAddEventTypeButton = async () => {
	await clickButton(EventTypesPage.addEventTypeButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.selectEmployeeDropdownCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await waitUntil(3000);
	await clickButton(EventTypesPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(EventTypesPage.selectEmployeeDropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const titleInputVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.titleInputCss);
};

export const enterTitleInputData = async (data) => {
	await clearField(EventTypesPage.titleInputCss);
	await enterInput(EventTypesPage.titleInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.descriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(EventTypesPage.descriptionInputCss);
	await enterInput(EventTypesPage.descriptionInputCss, data);
};

export const durationInputVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.durationInputCss);
};

export const enterDurationInputData = async (data) => {
	await clearField(EventTypesPage.durationInputCss);
	await enterInput(EventTypesPage.durationInputCss, data);
};

export const checkboxVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.activeCheckboxCss);
};

export const clickCheckbox = async () => {
	await clickButton(EventTypesPage.activeCheckboxCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(EventTypesPage.saveButtonCss);
};

export const selectTableRowVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await waitUntil(3000);
	await clickButtonByIndex(EventTypesPage.selectTableRowCss, index);
};

export const editEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.editEventTypeButtonCss);
};

export const clickEditEventTypeButton = async () => {
	await clickButton(EventTypesPage.editEventTypeButtonCss);
};

export const deleteEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.deleteEventTypeButtonCss);
};

export const clickDeleteEventTypeButton = async () => {
	await clickButton(EventTypesPage.deleteEventTypeButtonCss);
};

export const confirmDeleteEventTypeButtonVisible = async () => {
	await verifyElementIsVisible(EventTypesPage.confirmDeleteEventTypeButtonCss);
};

export const clickConfirmDeleteEventTypeButton = async () => {
	await clickButton(EventTypesPage.confirmDeleteEventTypeButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EventTypesPage.toastrMessageCss);
};
