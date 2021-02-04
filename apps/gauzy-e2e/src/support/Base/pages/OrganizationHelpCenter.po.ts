import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickElementByText,
	getLastElement,
	verifyText,
	verifyElementNotExist,
	clickButtonMultipleTimes
} from '../utils/util';
import { OrganizationHelpCenterPage } from '../pageobjects/OrganizationHelpCenterPageObject';

export const addButtonVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(OrganizationHelpCenterPage.addButtonCss);
};

export const languageDropdownVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.languageDropdownCss);
};

export const clickLanguageDropdown = () => {
	clickButton(OrganizationHelpCenterPage.languageDropdownCss);
};

export const selectLanguageFromDropdown = (text) => {
	clickElementByText(OrganizationHelpCenterPage.dropdownOptionCss, text);
};

export const publishButtonVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.toggleButtonCss);
};

export const clickPublishButton = () => {
	clickButton(OrganizationHelpCenterPage.toggleButtonCss);
};

export const iconDropdownVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.iconDropdownCss);
};

export const clickIconDropdown = () => {
	clickButton(OrganizationHelpCenterPage.iconDropdownCss);
};

export const selectIconFromDropdown = (index) => {
	clickButtonByIndex(OrganizationHelpCenterPage.dropdownOptionCss, index);
};

export const colorInputVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.colorInputCss);
};

export const enterColorInputData = (data) => {
	clearField(OrganizationHelpCenterPage.colorInputCss);
	enterInput(OrganizationHelpCenterPage.colorInputCss, data);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationHelpCenterPage.nameInputCss);
	enterInput(OrganizationHelpCenterPage.nameInputCss, data);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.descriptioninputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(OrganizationHelpCenterPage.descriptioninputCss);
	enterInput(OrganizationHelpCenterPage.descriptioninputCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(OrganizationHelpCenterPage.saveButtonCss);
};

export const settingsButtonVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.settingsButtonCss);
};

export const clickSettingsButton = (index) => {
	clickButtonByIndex(OrganizationHelpCenterPage.settingsButtonCss, index);
};

export const editBaseOptionVisible = () => {
	verifyElementIsVisible(
		OrganizationHelpCenterPage.settingsDropdownOptionCss
	);
};

export const clickEditBaseOption = (text) => {
	clickElementByText(
		OrganizationHelpCenterPage.settingsDropdownOptionCss,
		text
	);
};

export const deleteBaseOptionVisible = () => {
	verifyElementIsVisible(
		OrganizationHelpCenterPage.settingsDropdownOptionCss
	);
};

export const clickDeleteBaseOption = (text) => {
	clickElementByText(
		OrganizationHelpCenterPage.settingsDropdownOptionCss,
		text
	);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	getLastElement(OrganizationHelpCenterPage.deleteButtonCss);
};

export const clickCloseDeleteButton = (times) => {
	clickButtonMultipleTimes(
		OrganizationHelpCenterPage.closeDeleteButtonCss,
		times
	);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationHelpCenterPage.toastrMessageCss);
};

export const verifybaseExists = (text) => {
	verifyText(OrganizationHelpCenterPage.verifyBaseCss, text);
};

export const verifyBaseIsDeleted = () => {
	verifyElementNotExist(OrganizationHelpCenterPage.verifyBaseCss);
};
