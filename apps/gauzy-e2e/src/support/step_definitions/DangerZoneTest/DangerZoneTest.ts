import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dangerZonePage from '../../Base/pages/DangerZone.po';
import { DangerZonePageData } from '../../Base/pagedata/DangerZonePageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given('Login with default credentials and visit Danger zone page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/settings/danger-zone');
});

// Danger zone page test
Then('User can verify Danger zone page', () => {
	dangerZonePage.verifyHeaderTextExist(DangerZonePageData.headerText);
});

And('User can see delete button', () => {
	dangerZonePage.deleteButtonVisible();
});

When('User click on delete button', () => {
	dangerZonePage.clickDeleteButton(0);
});

Then('User can see confirm delete text', () => {
	dangerZonePage.verifyDeleteTextExist(DangerZonePageData.confirmDeleteText);
});

And('User can input field', () => {
	dangerZonePage.deleteInputVisible();
});

And('User can enter data into input field', () => {
	dangerZonePage.enterInputData(DangerZonePageData.deleteUserText);
});

Then('User can see confirm delete button', () => {
	dangerZonePage.confirmDeleteButtonVisible();
});

And('User can see cancel delete button', () => {
	dangerZonePage.cancelButtonVisible();
});

When('User click on cancel delete button', () => {
	dangerZonePage.clickCancelButton();
});

Then('User can see again delete button', () => {
	dangerZonePage.verifyDeleteButtonText(DangerZonePageData.buttonText);
});
