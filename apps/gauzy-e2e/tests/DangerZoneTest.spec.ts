import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as dangerZonePage from './support/pages/DangerZone.po';
import { DangerZonePageData } from '../src/support/Base/pagedata/DangerZonePageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Danger zone Test', () => {
	test('Danger zone Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to verify danger zone', async () => {
			await getPage().goto('/#/pages/settings/danger-zone');
			await dangerZonePage.verifyHeaderTextExist(DangerZonePageData.headerText);
			await dangerZonePage.deleteButtonVisible();
			await dangerZonePage.clickDeleteButton();
			await dangerZonePage.verifyDeleteTextExist(DangerZonePageData.confirmDeleteText);
			await dangerZonePage.deleteInputVisible();
			await dangerZonePage.enterInputData(DangerZonePageData.deleteUserText);
			await dangerZonePage.confirmDeleteButtonVisible();
			await dangerZonePage.cancelButtonVisible();
			await dangerZonePage.clickCancelButton();
			await dangerZonePage.verifyDeleteButtonText(DangerZonePageData.buttonText);
		});
	});
});
