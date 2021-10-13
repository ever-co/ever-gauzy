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
	clickButtonMultipleTimes,
	verifyElementIsVisibleByIndex,
	enterTextInIFrame
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

export const clickAddCategotyOption = (text) => {
	clickElementByText(
		OrganizationHelpCenterPage.settingsDropdownOptionCss,
		text
	);
};

export const addCategoryOptionVisible = () => {
	verifyElementIsVisible(
		OrganizationHelpCenterPage.settingsDropdownOptionCss
	);
};

export const verifyCategoryExists = (text) => {
	verifyElementIsVisible(OrganizationHelpCenterPage.verifyCategortCss);
};

export const arrowButtonVisible = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.arrowButtonCss);
};

export const clickArrowButton = () => {
	clickButton(OrganizationHelpCenterPage.arrowButtonCss);
};

export const clickOnCategory = (index) => {
	clickButtonByIndex(OrganizationHelpCenterPage.verifyCategortCss, index)
};

export const verifyAddArticleButton = (index) => {
	verifyElementIsVisibleByIndex(OrganizationHelpCenterPage.addArticleButtonCss, index)
};

export const clickOnAddArticleButton = (index) => {
	clickButtonByIndex(OrganizationHelpCenterPage.addArticleButtonCss, index)
};

export const verifyNameOfTheArticleInput = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.nameOfTheArticleInputCss);
};

export const enterArticleName = (articleName) => {
	enterInput(OrganizationHelpCenterPage.nameOfTheArticleInputCss, articleName);
}

export const verifyDescOfTheArticleInput = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.descOfTheArticleInputCss);
};

export const enterDescName = (descName) => {
	enterInput(OrganizationHelpCenterPage.descOfTheArticleInputCss, descName);
}

export const verifyEmployeePlaceholderField = (index) => {
	verifyElementIsVisibleByIndex(OrganizationHelpCenterPage.employeePlaceholderCss, index);
};

export const clickOnEmployeePlaceholderField = (index) => {
	clickButtonByIndex(OrganizationHelpCenterPage.employeePlaceholderCss, index);
};

export const clickEmployeeDropdown = (index) => {
	clickButtonByIndex(OrganizationHelpCenterPage.employeeDropdownCss, index);
};

export const verifyArticleText = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.articleTextCss);
};

export const enterArticleText = (text) => {
	enterTextInIFrame(OrganizationHelpCenterPage.articleTextCss, text);
};

export const clickArticleText = () => {
	clickButton(OrganizationHelpCenterPage.articleTextCss);
};

export const verifyArticleSaveBtn = () => {
	verifyElementIsVisible(OrganizationHelpCenterPage.articleSaveBtnCss);
};

export const clickArticleSaveBtn = () => {
	clickButton(OrganizationHelpCenterPage.articleSaveBtnCss);
};