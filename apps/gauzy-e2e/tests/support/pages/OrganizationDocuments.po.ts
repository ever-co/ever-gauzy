import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickButtonWithDelay,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationDocumentsPage } from '../../../src/support/Base/pageobjects/OrganizationDocumentsPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.gridButtonCss);
};

export const gridBtnClick = async (index: number) => {
	await clickButtonByIndex(OrganizationDocumentsPage.gridButtonCss, index);
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(OrganizationDocumentsPage.addButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationDocumentsPage.nameInputCss);
	await enterInput(OrganizationDocumentsPage.nameInputCss, data);
};

export const urlInputVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.urlInputCss);
};

export const enterUrlInputData = async (data: string) => {
	await enterInput(OrganizationDocumentsPage.urlInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButtonWithDelay(OrganizationDocumentsPage.saveButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	await clickButtonByIndex(OrganizationDocumentsPage.editButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.deleteButtonCss);
};

export const clickDeleteButton = async (index: number) => {
	await clickButtonByIndex(OrganizationDocumentsPage.deleteButtonCss, index);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDocumentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationDocumentsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationDocumentsPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationDocumentsPage.toastrMessageCss);
};

export const verifyDocumentExists = async (text: string) => {
	await verifyText(OrganizationDocumentsPage.verifyDocumentCss, text);
};

export const verifyDocumentIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationDocumentsPage.verifyDocumentCss, text);
};
