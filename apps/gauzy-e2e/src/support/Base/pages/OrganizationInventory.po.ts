import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	clickButtonByText,
	verifyText,
	verifyTextNotExisting
} from '../utils/util';
import { OrganizationInventoryPage } from '../pageobjects/OrganizationInventoryPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationInventoryPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationInventoryPage.gridButtonCss, index);
};

export const addCategoryOrTypeButtonVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.addCategoryOrTypeButtonCss
	);
};

export const clickAddCategoryOrTypeButton = (text) => {
	clickButtonByText(text);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(OrganizationInventoryPage.addButtonCss);
};

export const languageDropdownVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.languageDropdownCss);
};

export const clickLangaugeDropdown = () => {
	clickButton(OrganizationInventoryPage.languageDropdownCss);
};

export const productTypeDropdownVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.productTypeDropdownCss);
};

export const clickProductTypeDrodpwon = () => {
	clickButton(OrganizationInventoryPage.productTypeDropdownCss);
};

export const productCategoryDropdownVisible = () => {
	verifyElementIsVisible(
		OrganizationInventoryPage.productCategoryDropdownCss
	);
};

export const clickProductCategoryDrodpwon = () => {
	clickButton(OrganizationInventoryPage.productCategoryDropdownCss);
};

export const clickDropdownOption = (text) => {
	clickElementByText(OrganizationInventoryPage.dropdownOptionCss, text);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationInventoryPage.nameInputCss);
	enterInput(OrganizationInventoryPage.nameInputCss, data);
};

export const codeInputVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.codeInputCss);
};

export const enterCodeInputData = (data) => {
	clearField(OrganizationInventoryPage.codeInputCss);
	enterInput(OrganizationInventoryPage.codeInputCss, data);
};

export const descriptionInputVisivle = () => {
	verifyElementIsVisible(OrganizationInventoryPage.descriptionInputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(OrganizationInventoryPage.descriptionInputCss);
	enterInput(OrganizationInventoryPage.descriptionInputCss, data);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(OrganizationInventoryPage.backButtonCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(OrganizationInventoryPage.saveButtonCss);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.editButtonCss);
};

export const clickEditButton = () => {
	clickButton(OrganizationInventoryPage.editButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(OrganizationInventoryPage.deleteButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationInventoryPage.selectTableRowCss, index);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationInventoryPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationInventoryPage.toastrMessageCss);
};

export const verifyTypeExists = (text) => {
	verifyText(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyTypeIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationInventoryPage.verifyTypeCss, text);
};

export const verifyCategorieExists = (text) => {
	verifyText(OrganizationInventoryPage.verifyCategorieCss, text);
};

export const verifyCategorieIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationInventoryPage.verifyCategorieCss, text);
};

export const verifyInventoryExists = (text) => {
	verifyText(OrganizationInventoryPage.verifyInventoryCss, text);
};

export const verifyInventoryIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationInventoryPage.verifyInventoryCss, text);
};
