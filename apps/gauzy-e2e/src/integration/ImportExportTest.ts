import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as importExportPage from '../support/Base/pages/ImportExport.po';
import { ImportExportData } from '../support/Base/pagedata/ImportExportPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Import/Export Test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should able to verify Import/Export', () => {
		cy.visit('/#/pages/settings/import-export');
		importExportPage.headerTextExist(ImportExportData.headerText);
		importExportPage.subheaderTextExist(ImportExportData.subheaderText);
		importExportPage.infoTextExist(ImportExportData.firstInfo);
		importExportPage.infoTextExist(ImportExportData.secondInfo);
		importExportPage.infoTextExist(ImportExportData.thirdInfo);
		importExportPage.importButtonVisible();
		importExportPage.exportButtonVisible();
		importExportPage.downloadButtonVisible();
	});
});
