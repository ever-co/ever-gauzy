import {
	verifyElementIsVisible,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	waitElementToHide
} from '../utils/util';
import { OrganizationTagsPage } from '../pageobjects/OrganizationTagsPageObject';

export const gridButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.gridButtonCss);
};

export const clickGridButton = (index) => {
	clickButtonByIndex(OrganizationTagsPage.gridButtonCss, index);
};

export const addTagButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.addTagButtonCss);
};

export const clickAddTagButton = () => {
	clickButton(OrganizationTagsPage.addTagButtonCss);
};

export const closeDialogButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.closeDialogButtonCss);
};

export const clickCloseDialogButton = () => {
	clickButton(OrganizationTagsPage.closeDialogButtonCss);
};

export const tagNameInputVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.tagNameInputCss);
};

export const enterTagNameData = (data) => {
	clearField(OrganizationTagsPage.tagNameInputCss);
	enterInput(OrganizationTagsPage.tagNameInputCss, data);
};

export const tagColorInputVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.tagColorInputCss);
};

export const enterTagColorData = (data) => {
	clearField(OrganizationTagsPage.tagColorInputCss);
	enterInput(OrganizationTagsPage.tagColorInputCss, data);
};

export const checkboxTenantLevelVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.tagTenantCheckboxCss);
};

export const clickCheckboxTenantLevel = () => {
	clickButton(OrganizationTagsPage.tagTenantCheckboxCss);
};

export const tagDescriptionTextareaVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.tagDescriptionCss);
};

export const enterTagDescriptionData = (data) => {
	clearField(OrganizationTagsPage.tagDescriptionCss);
	enterInput(OrganizationTagsPage.tagDescriptionCss, data);
};

export const cancelAddTagButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.cancelButtonCss);
};

export const clickCancelAddTagButton = () => {
	clickButton(OrganizationTagsPage.cancelButtonCss);
};

export const saveTagButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.saveButtonCss);
};

export const clickSaveTagButton = () => {
	clickButton(OrganizationTagsPage.saveButtonCss);
};

export const tagsTableDataVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationTagsPage.selectTableRowCss, index);
};

export const editTagButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.editTagButtonCss);
};

export const clickEditTagButton = () => {
	clickButton(OrganizationTagsPage.editTagButtonCss);
};

export const deleteTagButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.deleteTagButtonCss);
};

export const clickDeleteTagButton = () => {
	clickButton(OrganizationTagsPage.deleteTagButtonCss);
};

export const cancelDeleteTagButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.cancelDeleteTagButtonCss);
};

export const clickCancelDeleteTagButton = () => {
	clickButton(OrganizationTagsPage.cancelDeleteTagButtonCss);
};

export const confirmDeleteTagButtonVisible = () => {
	verifyElementIsVisible(OrganizationTagsPage.confirmDeleteTagButtonCss);
};

export const clickConfirmDeleteTagButton = () => {
	clickButton(OrganizationTagsPage.confirmDeleteTagButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationTagsPage.toastrMessageCss);
};
