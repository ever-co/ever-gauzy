import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as addEmployeeLevelPage from '../../Base/pages/AddEmployeeLevel.po';
import { AddEmployeeLevelPageData } from '../../Base/pagedata/AddEmployeeLevelPageData';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../../support/commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const responseTimeout = Cypress.config('responseTimeout');

// Login with email
Given('Visit home page as unauthorized user', () => {
	cy.visit('/', { timeout: responseTimeout, retryOnNetworkFailure: true });
	loginPage.verifyTitle();
});

Then('User can see login text', () => {
	loginPage.verifyLoginText();
});

And('User cane see email input', () => {
	loginPage.clearEmailField();
});

And('Use can enter value for email', () => {
	loginPage.enterEmail(LoginPageData.email);
});

And('User cane see password input', () => {
	loginPage.clearPasswordField();
});

And('Use can enter value for password', () => {
	loginPage.enterPassword(LoginPageData.password);
});

When('User click on login button', () => {
	loginPage.clickLoginButton();
});

Then('User will see Create button', () => {
	dashboardPage.verifyCreateButton();
});

// Add new tag
When('User go to Tags page', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.visit('/#/pages/organization/tags');
});

Then('User can see grid button on top right corner', () => {
	organizationTagsUserPage.gridButtonVisible();
});

When('User click on grid second grid button to change view', () => {
	organizationTagsUserPage.clickGridButton(1);
});

Then('User can see Add tag button', () => {
	organizationTagsUserPage.addTagButtonVisible();
});

When('User click on Add tag button', () => {
	organizationTagsUserPage.clickAddTagButton();
});

Then('User will see tag name input', () => {
	organizationTagsUserPage.tagNameInputVisible();
});

And('User can enter value for tag name', () => {
	organizationTagsUserPage.enterTagNameData(OrganizationTagsPageData.tagName);
});

And('User can see tag color input', () => {
	organizationTagsUserPage.tagColorInputVisible();
});

And('User can enter value for tag color', () => {
	organizationTagsUserPage.enterTagColorData(
		OrganizationTagsPageData.tagColor
	);
});

And('User can see tag description input', () => {
	organizationTagsUserPage.tagDescriptionTextareaVisible();
});

And('User can enter value for tag description', () => {
	organizationTagsUserPage.enterTagDescriptionData(
		OrganizationTagsPageData.tagDescription
	);
});

And('User can see save tag button', () => {
	organizationTagsUserPage.saveTagButtonVisible();
});

And('User can click on save tag button', () => {
	organizationTagsUserPage.clickSaveTagButton();
});

// Add new employee level
When('User visit Add new employee level page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.visit('/#/pages/employees/employee-level', { timeout: responseTimeout });
});

Then('User can see grid button', () => {
	addEmployeeLevelPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	addEmployeeLevelPage.gridBtnClick(1);
});

And('User can see Add new level button', () => {
	addEmployeeLevelPage.addNewLevelButtonVisible();
});

When('User click on Add new level button', () => {
	addEmployeeLevelPage.clickAddNewLevelButton();
});

Then('User will see new level input', () => {
	addEmployeeLevelPage.newLevelInputVisible();
});

And('User can enter new level name', () => {
	addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
});

And('User can see tags multi-select', () => {
	addEmployeeLevelPage.tagsMultiSelectVisible();
});

When('User click on tags multi-select', () => {
	addEmployeeLevelPage.clickTagsMultiSelect();
});

Then('User can select tag from dropdown menu', () => {
	addEmployeeLevelPage.selectTagsFromDropdown(0);
	addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see Save button', () => {
	addEmployeeLevelPage.saveNewLevelButtonVisible();
});

When('User click on Save button', () => {
	addEmployeeLevelPage.clickSaveNewLevelButton();
});

Then('User will see notification message', () => {
	addEmployeeLevelPage.waitMessageToHide();
});

And('User can see Edit level button', () => {
	addEmployeeLevelPage.editEmployeeLevelButtonVisible();
});

When('User click on Edit level button', () => {
	addEmployeeLevelPage.clickEditEmployeeLevelButton();
});

Then('User can verify that new levelE was created', () => {
	addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelE);
});

And('User can see cancel edit button', () => {
	addEmployeeLevelPage.cancelButtonVisible();
});

And('User can cancel editing by clicking on cancel button', () => {
	addEmployeeLevelPage.clickCancelButton();
});

// Edit employee level
And('User can see edit level button', () => {
	addEmployeeLevelPage.editEmployeeLevelButtonVisible();
});

When('User click edit level button', () => {
	addEmployeeLevelPage.clickEditEmployeeLevelButton();
});

Then('User can see level name input', () => {
	addEmployeeLevelPage.editEmployeeLevelInpuVisible();
});

And('User can enter new level name data', () => {
	addEmployeeLevelPage.enterEditLevelData(AddEmployeeLevelPageData.levelF);
});

And('User can see tags multi-select', () => {
	addEmployeeLevelPage.tagsMultiSelectVisible();
});

When('User click on tags multi-select', () => {
	addEmployeeLevelPage.clickTagsMultiSelect();
});

Then('User can select tag from dropdown menu', () => {
	addEmployeeLevelPage.selectTagsFromDropdown(0);
	addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see Save button', () => {
	addEmployeeLevelPage.saveNewLevelButtonVisible();
});

When('User click on Save button', () => {
	addEmployeeLevelPage.clickSaveNewLevelButton();
});

Then('User will see notification message', () => {
	addEmployeeLevelPage.waitMessageToHide();
});

And('User can see Edit level button', () => {
	addEmployeeLevelPage.editEmployeeLevelButtonVisible();
});

When('User click on Edit level button', () => {
	addEmployeeLevelPage.clickEditEmployeeLevelButton();
});

Then('User can verify that new levelF was created', () => {
	addEmployeeLevelPage.verifyTitleExists(AddEmployeeLevelPageData.levelF);
});

And('User can see cancel edit button', () => {
	addEmployeeLevelPage.cancelButtonVisible();
});

And('User can cancel editing by clicking on cancel button', () => {
	addEmployeeLevelPage.clickCancelButton();
});

// Delete employee level
And('User can see Add new level button again', () => {
	addEmployeeLevelPage.addNewLevelButtonVisible();
});

When('User click on Add new level button again', () => {
	addEmployeeLevelPage.clickAddNewLevelButton();
});

Then('User will see new level input', () => {
	addEmployeeLevelPage.newLevelInputVisible();
});

And('User can enter another level name', () => {
	addEmployeeLevelPage.enterNewLevelData(AddEmployeeLevelPageData.levelE);
});

And('User can see tags multi-select', () => {
	addEmployeeLevelPage.tagsMultiSelectVisible();
});

When('User click on tags multi-select', () => {
	addEmployeeLevelPage.clickTagsMultiSelect();
});

Then('User can select tag from dropdown menu', () => {
	addEmployeeLevelPage.selectTagsFromDropdown(0);
	addEmployeeLevelPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see Save button', () => {
	addEmployeeLevelPage.saveNewLevelButtonVisible();
});

When('User click on Save button', () => {
	addEmployeeLevelPage.clickSaveNewLevelButton();
});

Then('User will see notification message', () => {
	addEmployeeLevelPage.waitMessageToHide();
});

And('User can see Delete level button', () => {
	addEmployeeLevelPage.deleteLevelButtonVisible();
});

When('User click on Delete level button', () => {
	addEmployeeLevelPage.clickDeleteLevelButton();
});

Then('User will see Confirm delete button', () => {
	addEmployeeLevelPage.confirmDeleteButtonVisible();
});

When('User click on Confirm delete button', () => {
	addEmployeeLevelPage.clickConfirmDeleteLevelButton();
});

Then('User can verify that levelE was deleted', () => {
	addEmployeeLevelPage.verifyElementIsDeleted(
		AddEmployeeLevelPageData.levelE
	);
});

And('User will see notification message', () => {
	addEmployeeLevelPage.waitMessageToHide();
});

Then('User can see Delete button again', () => {
	addEmployeeLevelPage.deleteLevelButtonVisible();
});

When('User click on Delete button', () => {
	addEmployeeLevelPage.clickDeleteLevelButton();
});

Then('User can see Confirm delete button', () => {
	addEmployeeLevelPage.confirmDeleteButtonVisible();
});

And('User can click on Confirm delete button', () => {
	addEmployeeLevelPage.clickConfirmDeleteLevelButton();
});
