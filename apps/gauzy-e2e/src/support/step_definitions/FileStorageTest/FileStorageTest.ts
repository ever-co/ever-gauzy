import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as fileStoragePage from '../../Base/pages/FileStorage.po';
import { FileStoragePageData } from '../../Base/pagedata/FileStoragePageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add S3 file provider
And('User can visit File storage page', () => {
	dashboardPage.verifyAccountingDashboardIfVisible()
	cy.visit('/#/pages/settings/file-storage', { timeout: pageLoadTimeout });
});

And('User can verify File storage page', () => {
	fileStoragePage.verifyHeader(FileStoragePageData.header);
});

Then('User can see provider dropdown', () => {
	fileStoragePage.dropdownVisible();
});

When('User click provider dropdown', () => {
	fileStoragePage.clickDropdown();
});

Then('User can select provider from dropdown options', () => {
	fileStoragePage.selectOptionFromDropdown(1);
});

And('User can see access key input field', () => {
	fileStoragePage.accessKeyInputVisible();
});

And('User can enter value for access key', () => {
	fileStoragePage.enterAccessKeyInputData(FileStoragePageData.accessKeyId);
});

And('User can see secret key input field', () => {
	fileStoragePage.secretKeyInputVisible();
});

And('User can enter value for secret key', () => {
	fileStoragePage.enterSecretKeyInputData(
		FileStoragePageData.secretAccessKey
	);
});

And('User can see region input field', () => {
	fileStoragePage.regioninputVisible();
});

And('User can enter value for region', () => {
	fileStoragePage.enterRegionInputData(FileStoragePageData.region);
});

And('User can see bucket input field', () => {
	fileStoragePage.bucketInputVisible();
});

And('User can enter value for bucket', () => {
	fileStoragePage.enterBucketInputData(FileStoragePageData.bucket);
});

And('User can see save button', () => {
	fileStoragePage.saveButtonVisible();
});

When('User click on save button', () => {
	fileStoragePage.clickSaveButton();
});

Then('Notification message will appear', () => {
	fileStoragePage.waitMessageToHide();
});
