import {
	waitUntil,
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	verifyByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationTagsPage } from '../../../src/support/Base/pageobjects/OrganizationTagsPageObject';

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.addTagButtonCss);
};

export const clickAddTagButton = async () => {
	await clickButton(OrganizationTagsPage.addTagButtonCss);
};

export const closeDialogButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.closeDialogButtonCss);
};

export const clickCloseDialogButton = async () => {
	await clickButton(OrganizationTagsPage.closeDialogButtonCss);
};

export const tagNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagNameInputCss);
};

export const enterTagNameData = async (data) => {
	await clearField(OrganizationTagsPage.tagNameInputCss);
	await enterInput(OrganizationTagsPage.tagNameInputCss, data);
};

export const tagColorInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagColorInputCss);
};

export const enterTagColorData = async (data) => {
	await clearField(OrganizationTagsPage.tagColorInputCss);
	await enterInput(OrganizationTagsPage.tagColorInputCss, data);
};

export const checkboxTenantLevelVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagTenantCheckboxCss);
};

export const clickCheckboxTenantLevel = async () => {
	await clickButton(OrganizationTagsPage.tagTenantCheckboxCss);
};

export const tagDescriptionTextareaVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.tagDescriptionCss);
};

export const enterTagDescriptionData = async (data) => {
	await clearField(OrganizationTagsPage.tagDescriptionCss);
	await enterInput(OrganizationTagsPage.tagDescriptionCss, data);
};

export const cancelAddTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.cancelButtonCss);
};

export const clickCancelAddTagButton = async () => {
	await clickButton(OrganizationTagsPage.cancelButtonCss);
};

export const saveTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.saveButtonCss);
};

export const clickSaveTagButton = async () => {
	await clickButton(OrganizationTagsPage.saveButtonCss);
};

export const tagsTableDataVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(OrganizationTagsPage.selectTableRowCss, index);
};

export const editTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.editTagButtonCss);
};

export const clickEditTagButton = async () => {
	await clickButton(OrganizationTagsPage.editTagButtonCss);
};

export const deleteTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.deleteTagButtonCss);
};

export const clickDeleteTagButton = async () => {
	await clickButton(OrganizationTagsPage.deleteTagButtonCss);
};

export const cancelDeleteTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.cancelDeleteTagButtonCss);
};

export const clickCancelDeleteTagButton = async () => {
	await clickButton(OrganizationTagsPage.cancelDeleteTagButtonCss);
};

export const confirmDeleteTagButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.confirmDeleteTagButtonCss);
};

export const clickConfirmDeleteTagButton = async () => {
	await clickButton(OrganizationTagsPage.confirmDeleteTagButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationTagsPage.toastrMessageCss);
};

export const verifyTagExists = async (text) => {
	await verifyText(OrganizationTagsPage.verifyTagCss, text);
};

export const verifyTagIsDeleted = async (text) => {
	await verifyTextNotExisting(OrganizationTagsPage.verifyTagCss, text);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTagsPage.filterNameInputCss);
};

export const enterFilterInputData = async (text) => {
	await enterInput(OrganizationTagsPage.filterNameInputCss, text);
	await waitUntil(2000);
};

export const filteredTagVisible = async (text) => {
	await verifyByText(OrganizationTagsPage.firstTableCellTagCss, text);
};

export const clearFilterInputField = async () => {
	await clearField(OrganizationTagsPage.filterNameInputCss);
	await waitUntil(1000);
};
