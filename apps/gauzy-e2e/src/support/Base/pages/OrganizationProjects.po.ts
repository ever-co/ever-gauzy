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
	clickElementByText,
	clickLastButton
} from '../utils/util';
import { OrganizationProjectsPage } from '../pageobjects/OrganizationProjectsPageObject';

export const visit = (options = {}) => {
	cy.intercept('api/**/organization-projects/**').as('organizationProjects');
	cy.visit('/#/pages/organization/projects', options);
	cy.wait('@organizationProjects');
};

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
	verifyElementIsVisible(OrganizationProjectsPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(OrganizationProjectsPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.selectEmployeeDropdownOptionCss, index);
};

export const selectEmployeeFromDropdownByName = (name) => {
	clickElementByText(OrganizationProjectsPage.selectEmployeeDropdownOptionCss, name);
};

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.tagsSelectCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(OrganizationProjectsPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.tagsSelectOptionCss, index);
};

export const ownerDropdownVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.ownerDropdownCss);
};

export const clickOwnerDropdown = () => {
	clickButton(OrganizationProjectsPage.ownerDropdownCss);
};

export const selectOwnerDropdownOption = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.ownerDropdownOptionCss, index);
};

export const clientsDropdownVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.clientsDropdownCss);
};

export const clickClientsDropdown = () => {
	clickButton(OrganizationProjectsPage.clientsDropdownCss);
};

export const selectClientsDropdownOption = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.clientsDropdownOptionCss, index);
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

export type TabButtonName =
	| 'Main'
	| 'Description'
	| 'Billing'
	| 'Budget'
	| 'Open-Source'
	| 'Sprints'
	| 'Settings'
	| 'Module';
export const clickTabButtonByName = (name: TabButtonName) => {
	cy.get(OrganizationProjectsPage.tabSetCss).contains(name).click();
};

export const budgetHoursInputVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.budgetInputCss);
};

export const enterBudgetHoursInputData = (data) => {
	clearField(OrganizationProjectsPage.budgetInputCss);
	enterInput(OrganizationProjectsPage.budgetInputCss, data);
};

export const enterDescriptionInputData = (data) => {
	clearField(OrganizationProjectsPage.projectDescriptionCss);
	enterInput(OrganizationProjectsPage.projectDescriptionCss, data);
};

export const saveProjectButtonVisible = () => {
	cy.get(OrganizationProjectsPage.footerCss)
		.findByRole('button', { name: OrganizationProjectsPage.saveButtonName })
		.should('be.visible');
};

export const clickSaveProjectButton = () => {
	cy.get(OrganizationProjectsPage.footerCss)
		.findByRole('button', { name: OrganizationProjectsPage.saveButtonName })
		.click({ force: true });
};

export const tableRowVisible = () => {
	verifyElementIsVisible(OrganizationProjectsPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(OrganizationProjectsPage.selectTableRowCss, index);
};

export const selectLastTableRow = () => {
	clickLastButton(OrganizationProjectsPage.selectTableRowCss);
};

export const selectTableRowByName = (name) => {
	clickElementByText(OrganizationProjectsPage.selectTableRowCss, name);
};

export const editButtonVisible = () => {
	cy.get(OrganizationProjectsPage.actionsBarCss)
		.findByRole('button', { name: OrganizationProjectsPage.editButtonName })
		.should('be.visible');
};

export const clickEditButton = () => {
	cy.get(OrganizationProjectsPage.actionsBarCss)
		.findByRole('button', { name: OrganizationProjectsPage.editButtonName })
		.click();
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
	cy.log('text', text);
	verifyText(OrganizationProjectsPage.verifyProjectCss, text);
};

export const verifyProjectIsDeleted = (text) => {
	verifyTextNotExisting(OrganizationProjectsPage.verifyProjectCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(OrganizationProjectsPage.toastrMessageCss);
};

export const clickSaveProjectButtonWithIndex = (index: number) => {
	clickButtonByIndex(OrganizationProjectsPage.saveProjectButtonCss, index);
};
