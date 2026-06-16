import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyStateByIndex,
	clickKeyboardBtnByKeycode
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { GoalsGeneralSettingsPage } from '../../../src/support/Base/pageobjects/GoalsGeneralSettingsPageObject';

export const verifyHeaderText = async (text) => {
	await verifyText(GoalsGeneralSettingsPage.headerTextCss, text);
};

export const verifySubheaderText = async (text) => {
	await verifyText(GoalsGeneralSettingsPage.subheaderTextCss, text);
};

export const goalsInputVisible = async () => {
	await verifyElementIsVisible(GoalsGeneralSettingsPage.goalsInpuCss);
};

export const enterGoalsInputData = async (data) => {
	await clearField(GoalsGeneralSettingsPage.goalsInpuCss);
	await enterInput(GoalsGeneralSettingsPage.goalsInpuCss, data);
};

export const keyResultInputVisible = async () => {
	await verifyElementIsVisible(GoalsGeneralSettingsPage.keyResultInputCss);
};

export const enterKeyResultInputData = async (data) => {
	await clearField(GoalsGeneralSettingsPage.keyResultInputCss);
	await enterInput(GoalsGeneralSettingsPage.keyResultInputCss, data);
};

export const objectivesDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsGeneralSettingsPage.objectivesDropdownCss);
};

export const clickObjectivesDropdown = async () => {
	await clickButton(GoalsGeneralSettingsPage.objectivesDropdownCss);
};

export const keyResultsDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsGeneralSettingsPage.keyResultDropdownCss);
};

export const clickKeyResultsDropdown = async () => {
	await clickButton(GoalsGeneralSettingsPage.keyResultDropdownCss);
};

export const verifyDropdownText = async (text) => {
	await verifyText(GoalsGeneralSettingsPage.optionDropdownCss, text);
};

export const verifyCheckboxState = async (index, state) => {
	await verifyStateByIndex(GoalsGeneralSettingsPage.checkboxCss, index, state);
};

export const clickToggleButtonByIndex = async (index) => {
	await clickButtonByIndex(GoalsGeneralSettingsPage.nbToggleCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(GoalsGeneralSettingsPage.toastrMessageCss);
};
