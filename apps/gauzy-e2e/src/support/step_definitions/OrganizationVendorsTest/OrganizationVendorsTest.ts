import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationVendorsPage from '../../Base/pages/OrganizationVendors.po';
import { OrganizationVendorsPageData } from '../../Base/pagedata/OrganizationVendorsPageData';
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

// Add tag
Then('User can add new tag', () => {
	waitUntil(3000);
	CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
});

// Add new vendor
And('User can visit Organization vendors page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/vendors', { timeout: pageLoadTimeout });
});

And('User can see grid button', () => {
	organizationVendorsPage.gridButtonVisible();
});

And('User can click on second grid button to change view', () => {
	organizationVendorsPage.clickGridButton(1);
});

And('User can see add vendor button', () => {
	organizationVendorsPage.addVendorButtonVisible();
});

When('User click on add vendor button', () => {
	organizationVendorsPage.clickAddVendorButton();
});

Then('User can see name input field', () => {
	organizationVendorsPage.nameInputVisible();
});

And('User can enter vendor name', () => {
	organizationVendorsPage.enterNameInputData(
		OrganizationVendorsPageData.vendorName
	);
});

And('User can see phone input field', () => {
	organizationVendorsPage.phoneInputVisible();
});

And('User can enter vendor phone', () => {
	organizationVendorsPage.enterPhoneInputData(
		OrganizationVendorsPageData.vendorPhone
	);
});

And('User can see email input field', () => {
	organizationVendorsPage.emailInputVisible();
});

And('User can enter vendor email', () => {
	organizationVendorsPage.enterEmailInputData(
		OrganizationVendorsPageData.vendorEmail
	);
});

And('User can see website input field', () => {
	organizationVendorsPage.websiteInputVisible();
});

And('User can enter vendor website', () => {
	organizationVendorsPage.enterWebsiteInputData(
		OrganizationVendorsPageData.vendorWebsite
	);
});

And('User can see tags dropdown', () => {
	organizationVendorsPage.tagsDropdownVisible();
});

When('User click on tags dropdown', () => {
	organizationVendorsPage.clickTagsDropdwon();
});

Then('User can select tag from dropdown options', () => {
	organizationVendorsPage.selectTagFromDropdown(0);
	organizationVendorsPage.clickKeyboardButtonByKeyCode(9);
});

And('User can see save button', () => {
	organizationVendorsPage.saveVendorButtonVisible();
});

When('User click on save button', () => {
	organizationVendorsPage.clickSaveVendorButton();
});

Then('Notification message will appear', () => {
	organizationVendorsPage.waitMessageToHide();
});

// Edit vendor
And('User can see edit button', () => {
	organizationVendorsPage.editVendorButtonVisible();
});

When('User click on edit button', () => {
	organizationVendorsPage.clickEditVendorButton(0);
});

Then('User can see name input field again', () => {
	organizationVendorsPage.nameInputVisible();
});

And('User can change vendor name', () => {
	organizationVendorsPage.enterNameInputData(
		OrganizationVendorsPageData.editVendorName
	);
});

And('User can see phone input field again', () => {
	organizationVendorsPage.phoneInputVisible();
});

And('User can change vendor phone', () => {
	organizationVendorsPage.enterPhoneInputData(
		OrganizationVendorsPageData.vendorPhone
	);
});

And('User can see email input field again', () => {
	organizationVendorsPage.emailInputVisible();
});

And('User can change vendor email', () => {
	organizationVendorsPage.enterEmailInputData(
		OrganizationVendorsPageData.vendorEmail
	);
});

And('User can see website input field again', () => {
	organizationVendorsPage.websiteInputVisible();
});

And('User can change vendor website', () => {
	organizationVendorsPage.enterWebsiteInputData(
		OrganizationVendorsPageData.vendorWebsite
	);
});

And('User can see save button again', () => {
	organizationVendorsPage.saveVendorButtonVisible();
});

When('User click on save button again', () => {
	organizationVendorsPage.clickSaveVendorButton();
});

Then('Notification message will appear', () => {
	organizationVendorsPage.waitMessageToHide();
});

// Delete vendor
And('User can see delete button', () => {
	organizationVendorsPage.deleteVendorButtonVisible();
});

When('User click on delete button', () => {
	organizationVendorsPage.clickDeleteVendorButton(0);
});

Then('User can see confirm delete button', () => {
	organizationVendorsPage.confirmDeletebuttonVisible();
});

When('User click on confirm delete button', () => {
	organizationVendorsPage.clickConfirmDeleteButton();
});

Then('Notification message will appear', () => {
	organizationVendorsPage.waitMessageToHide();
});
