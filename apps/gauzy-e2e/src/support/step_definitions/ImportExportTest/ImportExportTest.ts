import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as importExportPage from '../../Base/pages/ImportExport.po';
import { ImportExportData } from '../../Base/pagedata/ImportExportPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, And, When, Then } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given(
	'Login with default credentials and visit Settings Import Export page',
	() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		cy.visit('/#/pages/settings/import-export', {
			timeout: pageLoadTimeout
		});
	}
);

// Import/Export Test
And('User can verify header', () => {
	importExportPage.headerTextExist(ImportExportData.headerText);
});

And('User can verify subheader', () => {
	importExportPage.subheaderTextExist(ImportExportData.subheaderText);
});

And('User can verify Import text', () => {
	importExportPage.infoTextExist(ImportExportData.firstInfo);
});

And('User can verify Export text', () => {
	importExportPage.infoTextExist(ImportExportData.secondInfo);
});

And('User can verify Download text', () => {
	importExportPage.infoTextExist(ImportExportData.thirdInfo);
});

And('User can verify Import button', () => {
	importExportPage.importButtonVisible();
});

And('User can verify Export button', () => {
	importExportPage.exportBtnVisible();
});

// Verify migrate button works
And('User can see migrate button', () => {
	importExportPage.migrateBtnVisible();
});

When('User click on migrate button', () => {
	importExportPage.clickMigrateBtn();
});

Then('User can see password input field', () => {
	importExportPage.passwordInputVisible();
});

And('User can enter value for password', () => {
	importExportPage.enterPassword(ImportExportData.password);
});

And('User can see ok button', () => {
	importExportPage.okBtnVisible();
});

And('User can see cancel button', () => {
	importExportPage.cancelBtnVisible();
});

When('User click on cancel button', () => {
	importExportPage.clickCancelBtn();
});

Then('User can see again import button', () => {
	importExportPage.importButtonVisible();
});

// Upload file
When('User click on import button', () => {
	importExportPage.clickImportBtn();
});

Then('User can see browse files button', () => {
	importExportPage.browseFilesBtnVisible();
});

When('User attach file by clicking on browse file button', () => {
	importExportPage.uploadFile('archive.zip');
});

Then('User can see import file button', () => {
	importExportPage.importFileBtnVisible();
});

When('User click on import file button', () => {
	importExportPage.clickImportFileBtn();
});

Then('User can verify file was uplaoded by file name', () => {
	importExportPage.verifyFileName(ImportExportData.fileName);
});

And('User can verify file was uploaded by badge status', () => {
	importExportPage.verifyUploadStatus();
});

// Remove file
And('User can see remove file button', () => {
	importExportPage.removeFileBtnVisible();
});

When('User click on remove file button', () => {
	importExportPage.clickRemoveFileBtn();
});

Then('User can see again browse files button', () => {
	importExportPage.browseFilesBtnVisible();
});
