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
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationProjectsPage } from '../../../src/support/Base/pageobjects/OrganizationProjectsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const requestProjectButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.requestNewProjectButtonCss);
};

export const clickRequestProjectButton = async () => {
	await clickButton(OrganizationProjectsPage.requestNewProjectButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.projectNameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(OrganizationProjectsPage.projectNameInputCss);
	await enterInput(OrganizationProjectsPage.projectNameInputCss, data);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(OrganizationProjectsPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	await clickButtonByIndex(OrganizationProjectsPage.selectEmployeeDropdownOptionCss, index);
};

export const selectEmployeeFromDropdownByName = async (name) => {
	await clickElementByText(OrganizationProjectsPage.selectEmployeeDropdownOptionCss, name);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(OrganizationProjectsPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index) => {
	await clickButtonByIndex(OrganizationProjectsPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const colorInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.colorInputCss);
};

export const enterColorInputData = async (data) => {
	await clearField(OrganizationProjectsPage.colorInputCss);
	await enterInput(OrganizationProjectsPage.colorInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.projectDescriptionCss);
};

export const clickTabButton = async (index) => {
	await clickButtonByIndex(OrganizationProjectsPage.tabButtonCss, index);
};

export const budgetHoursInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.budgetInputCss);
};

export const enterBudgetHoursInputData = async (data) => {
	await enterInput(OrganizationProjectsPage.budgetInputCss, data);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(OrganizationProjectsPage.projectDescriptionCss);
	await enterInput(OrganizationProjectsPage.projectDescriptionCss, data);
};

export const saveProjectButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.saveProjectButtonCss);
};

export const clickSaveProjectButton = async () => {
	await clickButton(OrganizationProjectsPage.saveProjectButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(OrganizationProjectsPage.selectTableRowCss, index);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.editProjectButtonCss);
};

export const clickEditButton = async () => {
	await clickButton(OrganizationProjectsPage.editProjectButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.deleteProjectButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(OrganizationProjectsPage.deleteProjectButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(OrganizationProjectsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationProjectsPage.footerCss);
};

export const verifyProjectExists = async (text) => {
	await verifyText(OrganizationProjectsPage.verifyProjectCss, text);
};

export const verifyProjectIsDeleted = async (text) => {
	await verifyTextNotExisting(OrganizationProjectsPage.verifyProjectCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationProjectsPage.toastrMessageCss);
};

export const clickSaveProjectButtonWithIndex = async (index: number) => {
	await clickButtonByIndex(OrganizationProjectsPage.saveProjectButtonCss, index);
};
