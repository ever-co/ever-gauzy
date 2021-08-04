import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as importExportPage from '../../Base/pages/ImportExport.po';
import { ImportExportData } from '../../Base/pagedata/ImportExportPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, And } from 'cypress-cucumber-preprocessor/steps';

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
	importExportPage.exportButtonVisible();
});

And('User can verify Download button', () => {
	importExportPage.downloadButtonVisible();
});
