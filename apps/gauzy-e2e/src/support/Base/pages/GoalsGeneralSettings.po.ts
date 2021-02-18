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
} from '../utils/util';
import { GoalsGeneralSettingsPage } from '../pageobjects/GoalsGeneralSettingsPageObject';

export const verifyHeaderText = (text) => {
	verifyText(GoalsGeneralSettingsPage.headerTextCss, text);
};

export const verifySubheaderText = (text) => {
	verifyText(GoalsGeneralSettingsPage.subheaderTextCss, text);
};

export const goalsInputVisible = () => {
	verifyElementIsVisible(GoalsGeneralSettingsPage.goalsInpuCss);
};

export const enterGoalsInputData = (data) => {
	clearField(GoalsGeneralSettingsPage.goalsInpuCss);
	enterInput(GoalsGeneralSettingsPage.goalsInpuCss, data);
};

export const keyResultInputVisible = () => {
	verifyElementIsVisible(GoalsGeneralSettingsPage.keyResultInputCss);
};

export const enterKeyResultInputData = (data) => {
	clearField(GoalsGeneralSettingsPage.keyResultInputCss);
	enterInput(GoalsGeneralSettingsPage.keyResultInputCss, data);
};

export const objectivesDropdownVisible = () => {
	verifyElementIsVisible(GoalsGeneralSettingsPage.objectivesDropdownCss);
};

export const clickObjectivesDropdown = () => {
	clickButton(GoalsGeneralSettingsPage.objectivesDropdownCss);
};

export const keyResultsDropdownVisible = () => {
	verifyElementIsVisible(GoalsGeneralSettingsPage.keyResultDropdownCss);
};

export const clickKeyResultsDropdown = () => {
	clickButton(GoalsGeneralSettingsPage.keyResultDropdownCss);
};

export const verifyDropdownText = (text) => {
	verifyText(GoalsGeneralSettingsPage.optionDropdownCss, text);
};

export const verifyCheckboxState = (index, state) => {
	verifyStateByIndex(GoalsGeneralSettingsPage.checkboxCss, index, state);
};

export const clickToggleButtonByIndex = (index) => {
	clickButtonByIndex(GoalsGeneralSettingsPage.nbToggleCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const waitMessageToHide = () => {
	waitElementToHide(GoalsGeneralSettingsPage.toastrMessageCss);
};
