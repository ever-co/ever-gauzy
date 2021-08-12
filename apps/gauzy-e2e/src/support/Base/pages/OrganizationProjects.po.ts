import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyText,
	verifyTextNotExisting,
	waitElementToHide,
	clickElementByText
} from '../utils/util';
import { OrganizationProjectsPage } from '../pageobjects/OrganizationProjectsPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(OrganizationProjectsPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.gridButtonCss, index);
};

export const requestProjectButtonVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.requestNewProjectButtonCss);
};

export const clickRequestProjectButton = () => {
	clickButton(OrganizationProjectsPage.requestNewProjectButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.projectNameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(OrganizationProjectsPage.projectNameInputCss);
	enterInput(OrganizationProjectsPage.projectNameInputCss, data);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(
		OrganizationProjectsPage.selectEmloyeeMultyselectCss
	);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(OrganizationProjectsPage.selectEmloyeeMultyselectCss);
};

export const selectEmployeeDropdownOption = (index) => {
	clickButtonByIndex(
		OrganizationProjectsPage.selectEmployeeDropdownOptionCss,
		index
	);
};

export const selectEmployeeFromDropdownByName = (name) => {
	clickElementByText(
		OrganizationProjectsPage.selectEmployeeDropdownOptionCss,
		name
	);
};

export const tagsMultyselectVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.tagsSelectCss);
};

export const clickTagsMultyselect = () => {
	clickButton(OrganizationProjectsPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const colorInputVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.colorInputCss);
};

export const enterColorInputData = (data) => {
	clearField(OrganizationProjectsPage.colorInputCss);
	enterInput(OrganizationProjectsPage.colorInputCss, data);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.projectDescriptionCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.tabButtonCss, index);
};

export const budgetHoursInputVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.budgetInputCss);
};

export const enterBudgetHoursInputData = (data) => {
	enterInput(OrganizationProjectsPage.budgetInputCss, data);
};

export const enterDescriptionInputData = (data) => {
	clearField(OrganizationProjectsPage.projectDescriptionCss);
	enterInput(OrganizationProjectsPage.projectDescriptionCss, data);
};

export const saveProjectButtonVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.saveProjectButtonCss);
};

export const clickSaveProjectButton = () => {
	clickButton(OrganizationProjectsPage.saveProjectButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.selectTableRowCss, index);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.editProjectButtonCss);
};

export const clickEditButton = () => {
	clickButton(OrganizationProjectsPage.editProjectButtonCss);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.deleteProjectButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(OrganizationProjectsPage.deleteProjectButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(OrganizationProjectsPage.confirmDeleteButtonCss);
};

export const clickCardBody = () => {
	clickButton(OrganizationProjectsPage.footerCss);
};

export const verifyProjectExists = (text) => {
	verifyText(OrganizationProjectsPage.verifyProjectCss, text);
};

export const verifyProjectIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationProjectsPage.verifyProjectCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationProjectsPage.toastrMessageCss);
};
