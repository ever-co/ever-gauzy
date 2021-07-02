import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as addEmployeePositionPage from '../../Base/pages/AddEmployeePosition.po';
import { AddEmployeePositionPageData } from '../../Base/pagedata/AddEmployeePositionPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as organizationTagsUserPage from '../../Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../Base/pagedata/OrganizationTagsPageData';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new tag
Then('User can add new tag', () => {
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new employee position
Then('User can go to Employee postions page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/positions');
});

And('User will see grid button', () => {
	addEmployeePositionPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	addEmployeePositionPage.gridBtnClick(1);
});

And('User can see Add new position button', () => {
	addEmployeePositionPage.addNewPositionButtonVisible();
});

When('User click on Add new position button', () => {
	addEmployeePositionPage.clickAddNewPositionButton();
});

Then('User can see cancel button', () => {
	addEmployeePositionPage.cancelNewPositionButtonVisible();
});

And('User can click on cancel button', () => {
	addEmployeePositionPage.clickCancelNewPositionButton();
});

When('User click again on Add new position button', () => {
	addEmployeePositionPage.clickAddNewPositionButton();
});

Then('User can see new position input', () => {
	addEmployeePositionPage.newPositionInputVisible();
});

And('User can add data for new position', () => {
	addEmployeePositionPage.enterNewPositionData(
		AddEmployeePositionPageData.fullStackDeveloper
	);
});

And('User can see tag multiselect', () => {
	addEmployeePositionPage.tagsMultyselectVisible();
});

When('User click on tag multiselect', () => {
	addEmployeePositionPage.clickTagsMultyselect();
});

Then('User can pick tag from dropdown menu', () => {
	addEmployeePositionPage.selectTagsFromDropdown(0);
	addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save position button', () => {
	addEmployeePositionPage.savePositionButtonVisible();
});

When('User click on save position button', () => {
	addEmployeePositionPage.clickSavePositionButton();
});

Then('Notification message will appear', () => {
	addEmployeePositionPage.waitMessageToHide();
});

And('User can see edit position button', () => {
	addEmployeePositionPage.editEmployeePositionButtonVisible();
});

When('User click on edit position button', () => {
	addEmployeePositionPage.clickEditEmployeePositionButton();
});

Then('User can verify position was created', () => {
	addEmployeePositionPage.verifyTitleExists(
		AddEmployeePositionPageData.fullStackDeveloper
	);
});

And('User can see cancel edit button', () => {
	addEmployeePositionPage.cancelButtonVisible();
});

And('User can click on cancel edit button', () => {
	addEmployeePositionPage.clickCancelButton();
});

// Еdit employee position
Then('User can see edit newly position button', () => {
	addEmployeePositionPage.clickEditEmployeePositionButton();
});

When('User click on edit new position button', () => {
	addEmployeePositionPage.editEmployeePositionInpuVisible();
});

Then('User can edit previously created position', () => {
	addEmployeePositionPage.enterEditPositionData(
		AddEmployeePositionPageData.midLevelWebDeveloper
	);
});

And('User can see tag multiselect', () => {
	addEmployeePositionPage.tagsMultyselectVisible();
});

When('User click on tag multiselect', () => {
	addEmployeePositionPage.clickTagsMultyselect();
});

Then('User can pick tag from dropdown menu', () => {
	addEmployeePositionPage.selectTagsFromDropdown(0);
	addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save position button', () => {
	addEmployeePositionPage.savePositionButtonVisible();
});

When('User click on save position button', () => {
	addEmployeePositionPage.clickSavePositionButton();
});

Then('Notification message will appear', () => {
	addEmployeePositionPage.waitMessageToHide();
});

And('User can see edit position button', () => {
	addEmployeePositionPage.editEmployeePositionButtonVisible();
});

When('User click on edit position button', () => {
	addEmployeePositionPage.clickEditEmployeePositionButton();
});

Then('User can verify position was edited', () => {
	addEmployeePositionPage.verifyTitleExists(
		AddEmployeePositionPageData.midLevelWebDeveloper
	);
});

And('User can see cancel edit button', () => {
	addEmployeePositionPage.cancelButtonVisible();
});

And('User can click on cancel edit button', () => {
	addEmployeePositionPage.clickCancelButton();
});

// Delete employee position
And('User can see Add new position button', () => {
	addEmployeePositionPage.addNewPositionButtonVisible();
});

When('User click on Add new position button', () => {
	addEmployeePositionPage.clickAddNewPositionButton();
});

Then('User can see cancel button', () => {
	addEmployeePositionPage.cancelNewPositionButtonVisible();
});

And('User can click on cancel button', () => {
	addEmployeePositionPage.clickCancelNewPositionButton();
});

When('User click again on Add new position button', () => {
	addEmployeePositionPage.clickAddNewPositionButton();
});

Then('User can see new position input', () => {
	addEmployeePositionPage.newPositionInputVisible();
});

And('User can add data for new position', () => {
	addEmployeePositionPage.enterNewPositionData(
		AddEmployeePositionPageData.fullStackDeveloper
	);
});

And('User can see tag multiselect', () => {
	addEmployeePositionPage.tagsMultyselectVisible();
});

When('User click on tag multiselect', () => {
	addEmployeePositionPage.clickTagsMultyselect();
});

Then('User can pick tag from dropdown menu', () => {
	addEmployeePositionPage.selectTagsFromDropdown(0);
	addEmployeePositionPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save position button', () => {
	addEmployeePositionPage.savePositionButtonVisible();
});

When('User click on save position button', () => {
	addEmployeePositionPage.clickSavePositionButton();
});

Then('Notification message will appear', () => {
	addEmployeePositionPage.waitMessageToHide();
});

And('User can see delete position button', () => {
	addEmployeePositionPage.deletePositionButtonVisible();
});

When('User click on delete position button', () => {
	addEmployeePositionPage.clickDeletePositionButton();
});

Then('User can see confirm delete button', () => {
	addEmployeePositionPage.confirmDeleteButtonVisible();
});

When('User click on confirm delete button', () => {
	addEmployeePositionPage.clickConfirmDeletePositionButton();
});

Then('User can verify that position was deleted', () => {
	addEmployeePositionPage.verifyElementIsDeleted(
		AddEmployeePositionPageData.fullStackDeveloper
	);
});

And('User will see a notification message', () => {
	addEmployeePositionPage.waitMessageToHide();
});

And('User can see delete position button', () => {
	addEmployeePositionPage.deletePositionButtonVisible();
});

When('User click on delete position button', () => {
	addEmployeePositionPage.clickDeletePositionButton();
});

Then('User can see confirm delete button', () => {
	addEmployeePositionPage.confirmDeleteButtonVisible();
});

And('User click on confirm delete button', () => {
	addEmployeePositionPage.clickConfirmDeletePositionButton();
});
