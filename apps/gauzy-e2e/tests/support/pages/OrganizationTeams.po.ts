import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationTeamsPage } from '../../../src/support/Base/pageobjects/OrganizationTeamsPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.gridButtonCss);
};

export const gridBtnClick = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.gridButtonCss, index);
};

export const addTeamButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.addTeamButtonCss);
};

export const clickAddTeamButton = async () => {
	await clickButton(OrganizationTeamsPage.addTeamButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.teamNameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationTeamsPage.teamNameInputCss);
	await enterInput(OrganizationTeamsPage.teamNameInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(OrganizationTeamsPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.tagsSelectOptionCss, index);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.employeeMultiSelectCss);
};

export const clickEmployeeDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.employeeMultiSelectCss, index);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.selectDropdownOptionCss, index);
};

export const managerDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.managerMultiSelectCss);
};

export const clickManagerDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.managerMultiSelectCss, index);
};

export const selectManagerFromDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.selectDropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.cardBodyCss, index);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(OrganizationTeamsPage.saveButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.selectTableRowCss);
};

export const selectTableRow = async (index: number) => {
	await clickButtonByIndex(OrganizationTeamsPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.editButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(OrganizationTeamsPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(OrganizationTeamsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationTeamsPage.toastrMessageCss);
};

export const verifyTeamExists = async (text: string) => {
	await verifyText(OrganizationTeamsPage.verifyTeamCss, text);
};

export const verifyTeamIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationTeamsPage.verifyTeamCss, text);
};
