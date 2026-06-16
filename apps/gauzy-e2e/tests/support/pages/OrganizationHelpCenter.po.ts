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
	enterTextInIFrame,
	clickElementIfVisible
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationHelpCenterPage } from '../../../src/support/Base/pageobjects/OrganizationHelpCenterPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(OrganizationHelpCenterPage.addButtonCss);
};

export const languageDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.languageDropdownCss);
};

export const clickLanguageDropdown = async () => {
	await clickButton(OrganizationHelpCenterPage.languageDropdownCss);
};

export const selectLanguageFromDropdown = async (text: string) => {
	await clickElementByText(OrganizationHelpCenterPage.dropdownOptionCss, text);
};

export const publishButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.toggleButtonCss);
};

export const clickPublishButton = async () => {
	await clickButton(OrganizationHelpCenterPage.toggleButtonCss);
};

export const iconDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.iconDropdownCss);
};

export const clickIconDropdown = async () => {
	await clickButton(OrganizationHelpCenterPage.iconDropdownCss);
};

export const selectIconFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.dropdownOptionCss, index);
};

export const colorInputVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.colorInputCss);
};

export const enterColorInputData = async (data: string) => {
	await clearField(OrganizationHelpCenterPage.colorInputCss);
	await enterInput(OrganizationHelpCenterPage.colorInputCss, data);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationHelpCenterPage.nameInputCss);
	await enterInput(OrganizationHelpCenterPage.nameInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.descriptioninputCss);
};

export const enterDescriptionInputData = async (data: string) => {
	await clearField(OrganizationHelpCenterPage.descriptioninputCss);
	await enterInput(OrganizationHelpCenterPage.descriptioninputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(OrganizationHelpCenterPage.saveButtonCss);
};

export const settingsButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsButtonCss);
};

export const clickSettingsButton = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.settingsButtonCss, index);
};

export const editBaseOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsDropdownOptionCss);
};

export const clickEditBaseOption = async (text: string) => {
	await clickElementByText(OrganizationHelpCenterPage.settingsDropdownOptionCss, text);
};

export const deleteBaseOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsDropdownOptionCss);
};

export const clickDeleteBaseOption = async (text: string) => {
	await clickElementByText(OrganizationHelpCenterPage.settingsDropdownOptionCss, text);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await getLastElement(OrganizationHelpCenterPage.deleteButtonCss);
};

export const clickCloseDeleteButton = async (times: number) => {
	await clickButtonMultipleTimes(OrganizationHelpCenterPage.closeDeleteButtonCss, times);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationHelpCenterPage.toastrMessageCss);
};

export const verifyBaseExists = async (text: string) => {
	await verifyText(OrganizationHelpCenterPage.verifyBaseCss, text);
};

export const verifyBaseIsDeleted = async () => {
	await verifyElementNotExist(OrganizationHelpCenterPage.verifyBaseCss);
};

export const clickAddCategoryOption = async (text: string) => {
	await clickElementByText(OrganizationHelpCenterPage.settingsDropdownOptionCss, text);
};

export const addCategoryOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsDropdownOptionCss);
};

export const verifyCategoryExists = async (text: string) => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.verifyCategortCss);
};

export const arrowButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.arrowButtonCss);
};

export const clickArrowButton = async (index: number) => {
	await clickElementIfVisible(OrganizationHelpCenterPage.arrowButtonCss, index);
};

export const clickOnCategory = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.verifyCategortCss, index);
};

export const verifyAddArticleButton = async (index: number) => {
	await verifyElementIsVisibleByIndex(OrganizationHelpCenterPage.addArticleButtonCss, index);
};

export const clickOnAddArticleButton = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.addArticleButtonCss, index);
};

export const verifyNameOfTheArticleInput = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.nameOfTheArticleInputCss);
};

export const enterArticleName = async (articleName: string) => {
	await enterInput(OrganizationHelpCenterPage.nameOfTheArticleInputCss, articleName);
};

export const verifyDescOfTheArticleInput = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.descOfTheArticleInputCss);
};

export const enterDescName = async (descName: string) => {
	await enterInput(OrganizationHelpCenterPage.descOfTheArticleInputCss, descName);
};

export const verifyEmployeePlaceholderField = async (index: number) => {
	await verifyElementIsVisibleByIndex(OrganizationHelpCenterPage.employeePlaceholderCss, index);
};

export const clickOnEmployeePlaceholderField = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.employeePlaceholderCss, index);
};

export const clickEmployeeDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.employeeDropdownCss, index);
};

export const verifyArticleText = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.articleTextCss);
};

export const enterArticleText = async (text: string) => {
	await enterTextInIFrame(OrganizationHelpCenterPage.articleTextCss, text);
};

export const clickArticleText = async () => {
	await clickButton(OrganizationHelpCenterPage.articleTextCss);
};

export const verifyArticleSaveBtn = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.articleSaveBtnCss);
};

export const clickArticleSaveBtn = async () => {
	await clickButton(OrganizationHelpCenterPage.articleSaveBtnCss);
};
