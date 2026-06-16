import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as importExportPage from './support/pages/ImportExport.po';
import { ImportExportData } from '../src/support/Base/pagedata/ImportExportPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Import/Export Test', () => {
	test('Import/Export Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to verify Import/Export', async () => {
			await getPage().goto('/#/pages/settings/import-export');
			await importExportPage.headerTextExist(ImportExportData.headerText);
			await importExportPage.subheaderTextExist(ImportExportData.subheaderText);
			await importExportPage.infoTextExist(ImportExportData.firstInfo);
			await importExportPage.infoTextExist(ImportExportData.secondInfo);
			await importExportPage.infoTextExist(ImportExportData.thirdInfo);
			await importExportPage.importButtonVisible();
			await importExportPage.exportBtnVisible();
			await importExportPage.downloadBtnVisible();
		});
	});
});
