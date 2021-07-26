import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationHelpCenterPage from '../../Base/pages/OrganizationHelpCenter.po';
import { OrganizationHelpCenterPageData } from '../../Base/pagedata/OrganizationHelpCenterPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given(
	'Login with default credentials and visit Organization help center page',
	() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		cy.visit('/#/pages/organization/help-center');
	}
);

// Add base
And('User can see add button', () => {
	organizationHelpCenterPage.addButtonVisible();
});

When('User click on add button', () => {
	organizationHelpCenterPage.clickAddButton();
});

And('User can see publish button', () => {
	organizationHelpCenterPage.publishButtonVisible();
});

When('User click on publish  button', () => {
	organizationHelpCenterPage.clickPublishButton();
});

Then('User can see icon button', () => {
	organizationHelpCenterPage.iconDropdownVisible();
});

When('User click on icon button', () => {
	organizationHelpCenterPage.clickIconDropdown();
});

Then('User can select first item from dropdown', () => {
	organizationHelpCenterPage.selectIconFromDropdown(0);
});

And('User can see color input field', () => {
	organizationHelpCenterPage.colorInputVisible();
});

And('User can enter value for color', () => {
	organizationHelpCenterPage.enterColorInputData(
		OrganizationHelpCenterPageData.defaultColor
	);
});

And('User can see name input field', () => {
	organizationHelpCenterPage.nameInputVisible();
});

And('User can enter name', () => {
	organizationHelpCenterPage.enterNameInputData(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

And('User can see description input field', () => {
	organizationHelpCenterPage.descriptionInputVisible();
});

And('User can enter description', () => {
	organizationHelpCenterPage.enterDescriptionInputData(
		OrganizationHelpCenterPageData.defaultBaseDescription
	);
});

And('User can see save button', () => {
	organizationHelpCenterPage.saveButtonVisible();
});

When('User click on save button', () => {
	organizationHelpCenterPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationHelpCenterPage.waitMessageToHide();
});

And('User can verify base was created', () => {
	organizationHelpCenterPage.verifybaseExists(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

// Edit base
And('User can see settings button', () => {
	organizationHelpCenterPage.settingsButtonVisible();
});

When('User click on settings button', () => {
	organizationHelpCenterPage.clickSettingsButton(0);
});

Then('User can see edit button', () => {
	organizationHelpCenterPage.editBaseOptionVisible();
});

When('User click on edit button', () => {
	organizationHelpCenterPage.clickEditBaseOption(
		OrganizationHelpCenterPageData.editBaseOption
	);
});

Then('User can see color input field again', () => {
	organizationHelpCenterPage.colorInputVisible();
});

And('User can edit color', () => {
	organizationHelpCenterPage.enterColorInputData(
		OrganizationHelpCenterPageData.defaultColor
	);
});

And('User can see name input field again', () => {
	organizationHelpCenterPage.nameInputVisible();
});

And('User can edit name', () => {
	organizationHelpCenterPage.enterNameInputData(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

And('User can see description input field', () => {
	organizationHelpCenterPage.descriptionInputVisible();
});

And('User can edit description', () => {
	organizationHelpCenterPage.enterDescriptionInputData(
		OrganizationHelpCenterPageData.defaultBaseDescription
	);
});

And('User can see save edited base button', () => {
	organizationHelpCenterPage.saveButtonVisible();
});

When('User click on save edited base button', () => {
	organizationHelpCenterPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationHelpCenterPage.waitMessageToHide();
});

// Delete base
And('User can see settings button again', () => {
	organizationHelpCenterPage.settingsButtonVisible();
});

When('User click on settings button again', () => {
	organizationHelpCenterPage.clickSettingsButton(0);
});

Then('User can see delete base option', () => {
	organizationHelpCenterPage.deleteBaseOptionVisible();
});

When('User click on delete base option', () => {
	organizationHelpCenterPage.clickDeleteBaseOption(
		OrganizationHelpCenterPageData.deleteBaseOption
	);
});

Then('User can see delete button', () => {
	organizationHelpCenterPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	organizationHelpCenterPage.clickDeleteButton();
});

Then('Notification message will appear', () => {
	organizationHelpCenterPage.waitMessageToHide();
});