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
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationEmploymentTypesPage } from '../../../src/support/Base/pageobjects/OrganizationEmploymentTypesPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.gridButtonCss);
};

export const gridBtnClick = async (index: number) => {
	await clickButtonByIndex(OrganizationEmploymentTypesPage.gridButtonCss, index);
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(OrganizationEmploymentTypesPage.addButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clickButton(OrganizationEmploymentTypesPage.nameInputCss);
	await clearField(OrganizationEmploymentTypesPage.nameInputCss);
	await enterInput(OrganizationEmploymentTypesPage.nameInputCss, data);
};

export const editNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.editNameInputCss);
};

export const enterEditNameInputData = async (data: string) => {
	await clickButton(OrganizationEmploymentTypesPage.editNameInputCss);
	await clearField(OrganizationEmploymentTypesPage.editNameInputCss);
	await enterInput(OrganizationEmploymentTypesPage.editNameInputCss, data);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(OrganizationEmploymentTypesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationEmploymentTypesPage.tagsDropdownOption, index);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationEmploymentTypesPage.cardBodyCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(OrganizationEmploymentTypesPage.saveButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	await clickButtonByIndex(OrganizationEmploymentTypesPage.editButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.deleteButtonCss);
};

export const clickDeleteButton = async (index: number) => {
	await clickButtonByIndex(OrganizationEmploymentTypesPage.deleteButtonCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationEmploymentTypesPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationEmploymentTypesPage.toastrMessageCss);
};

export const verifyTypeExists = async (text: string) => {
	await verifyText(OrganizationEmploymentTypesPage.verifyTextCss, text);
};

export const verifyTypeIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationEmploymentTypesPage.verifyTextCss, text);
};
