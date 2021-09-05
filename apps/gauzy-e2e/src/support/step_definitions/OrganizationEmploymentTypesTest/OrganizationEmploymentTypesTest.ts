import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationEmploymentTypePage from '../../Base/pages/OrganizationEmploymentTypes.po';
import { OrganizationEmploymentTypesPageData } from '../../Base/pagedata/OrganizationEmploymentTypesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { waitUntil } from '../../Base/utils/util';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	waitUntil(3000);
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new employment type
And('User can visit Organization employment types page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/employment-types', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	organizationEmploymentTypePage.gridBtnExists();
});

And('User can click on grid button to change view', () => {
	organizationEmploymentTypePage.gridBtnClick(1);
});

And('User can see add button', () => {
	organizationEmploymentTypePage.addButtonVisible();
});

When('User click on add button', () => {
	organizationEmploymentTypePage.clickAddButton();
});

Then('User can see name input field', () => {
	organizationEmploymentTypePage.nameInputVisible();
});

And('User can enter value for name', () => {
	organizationEmploymentTypePage.enterNameInputData(
		OrganizationEmploymentTypesPageData.name
	);
});

And('User can see tags dropdown', () => {
	organizationEmploymentTypePage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	organizationEmploymentTypePage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	organizationEmploymentTypePage.selectTagFromDropdown(0);
	organizationEmploymentTypePage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save button', () => {
	organizationEmploymentTypePage.saveButtonVisible();
});

When('User click on save button', () => {
	organizationEmploymentTypePage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationEmploymentTypePage.waitMessageToHide();
});

And('User can verify employment type was created', () => {
	organizationEmploymentTypePage.verifyTypeExists(
		OrganizationEmploymentTypesPageData.name
	);
});

// Edit employment type
And('User can see edit button', () => {
	organizationEmploymentTypePage.editButtonVisible();
});

When('User click on edit button', () => {
	organizationEmploymentTypePage.clickEditButton(0);
});

Then('User can see edit name input field', () => {
	organizationEmploymentTypePage.editNameInputVisible();
});

And('User can enter new value for name', () => {
	organizationEmploymentTypePage.enterEditNameInputData(
		OrganizationEmploymentTypesPageData.editName
	);
});

And('User can see save edited type button', () => {
	organizationEmploymentTypePage.saveButtonVisible();
});

When('User click on save edited type button', () => {
	organizationEmploymentTypePage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationEmploymentTypePage.waitMessageToHide();
});

And('User can verify employment type was edited', () => {
	organizationEmploymentTypePage.verifyTypeExists(
		OrganizationEmploymentTypesPageData.editName
	);
});

// Delete employment type
And('User can see delete button', () => {
	organizationEmploymentTypePage.deleteButtonVisible();
});

When('User click on delete button', () => {
	organizationEmploymentTypePage.clickDeleteButton(0);
});

Then('User can see confirm delete button', () => {
	organizationEmploymentTypePage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	organizationEmploymentTypePage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationEmploymentTypePage.waitMessageToHide();
});
