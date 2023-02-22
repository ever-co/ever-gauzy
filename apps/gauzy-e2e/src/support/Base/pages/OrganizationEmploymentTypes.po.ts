import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../utils/util';
import { OrganizationEmploymentTypesPage } from '../pageobjects/OrganizationEmploymentTypesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationEmploymentTypesPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(OrganizationEmploymentTypesPage.addButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clickButton(OrganizationEmploymentTypesPage.nameInputCss);
	clearField(OrganizationEmploymentTypesPage.nameInputCss);
	enterInput(OrganizationEmploymentTypesPage.nameInputCss, data);
};

export const editNameInputVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.editNameInputCss);
};

export const enterEditNameInputData = (data) => {
	clickButton(OrganizationEmploymentTypesPage.editNameInputCss);
	clearField(OrganizationEmploymentTypesPage.editNameInputCss);
	enterInput(OrganizationEmploymentTypesPage.editNameInputCss, data);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = () => {
	clickButton(OrganizationEmploymentTypesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(OrganizationEmploymentTypesPage.tagsDropdownOption, index);
};

export const clickCardBody = () => {
	clickButton(OrganizationEmploymentTypesPage.cardBodyCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(OrganizationEmploymentTypesPage.editButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.deleteButtonCss);
};

export const clickDeleteButton = (index) => {
	clickButtonByIndex(OrganizationEmploymentTypesPage.deleteButtonCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationEmploymentTypesPage.toastrMessageCss);
};

export const verifyTypeExists = (text) => {
	verifyText(OrganizationEmploymentTypesPage.verifyTextCss, text);
};

export const verifyTypeIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationEmploymentTypesPage.verifyTextCss, text);
};
