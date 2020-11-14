import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide
} from '../utils/util';
import { OrganizationTeamsPage } from '../pageobjects/OrganizationTeamsPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationTeamsPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationTeamsPage.gridButtonCss, index);
};

export const addTeamButtonVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.addTeamButtonCss);
};

export const clickAddTeamButton = () => {
	clickButton(OrganizationTeamsPage.addTeamButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.teamNameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationTeamsPage.teamNameInputCss);
	enterInput(OrganizationTeamsPage.teamNameInputCss, data);
};

export const tagsMultyselectVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.tagsSelectCss);
};

export const clickTagsMultyselect = () => {
	clickButton(OrganizationTeamsPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(OrganizationTeamsPage.tagsSelectOptionCss, index);
};

export const clickEmployeeDropdown = () => {
	clickButton(OrganizationTeamsPage.employeeMultyselectCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(OrganizationTeamsPage.selectDropdownOptionCss, index);
};

export const clickManagerDropdown = () => {
	clickButton(OrganizationTeamsPage.managerMultyselectCss);
};

export const selectManagerFromDropdown = (index) => {
	clickButtonByIndex(OrganizationTeamsPage.selectDropdownOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = () => {
	clickButton(OrganizationTeamsPage.cardBodyCss);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(OrganizationTeamsPage.saveButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationTeamsPage.selectTableRowCss, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.editButtonCss);
};

export const clickEditButton = () => {
	clickButton(OrganizationTeamsPage.editButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(OrganizationTeamsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationTeamsPage.toastrMessageCss);
};
