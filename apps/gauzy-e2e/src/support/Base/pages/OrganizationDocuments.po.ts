import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickButtonWithDelay,
	waitElementToHide
} from '../utils/util';
import { OrganizationDocumentsPage } from '../pageobjects/OrganizationDocumentsPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationDocumentsPage.gridButtonCss, index);
};

export const addButtonVisible = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.addButtonCss);
};

export const clickAddButton = () => {
	clickButton(OrganizationDocumentsPage.addButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationDocumentsPage.nameInputCss);
	enterInput(OrganizationDocumentsPage.nameInputCss, data);
};

export const urlInputVisible = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.urlInputCss);
};

export const enterUrlInputData = (data) => {
	enterInput(OrganizationDocumentsPage.urlInputCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButtonWithDelay(OrganizationDocumentsPage.saveButtonCss);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(OrganizationDocumentsPage.editButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.deleteButtonCss);
};

export const clickDeleteButton = (index) => {
	clickButtonByIndex(OrganizationDocumentsPage.deleteButtonCss, index);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationDocumentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationDocumentsPage.confirmDeleteButtonCss);
};

export const clickCardBody = () => {
	clickButton(OrganizationDocumentsPage.cardBodyCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationDocumentsPage.toastrMessageCss);
};
