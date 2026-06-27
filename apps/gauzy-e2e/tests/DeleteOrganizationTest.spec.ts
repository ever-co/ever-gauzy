import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as deleteOrganizationPage from './support/pages/DeleteOrganization.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Delete Organization Test', () => {
	test('Delete Organization Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to delete organization', async () => {
			await getPage().goto('/#/pages/organizations');
			await deleteOrganizationPage.gridBtnExists();
			await deleteOrganizationPage.gridBtnClick();
			await deleteOrganizationPage.deleteBtnExists();
			// Selecting a row enables the (otherwise disabled) toolbar Delete button; deleteBtnClick
			// also selects internally, but make the prerequisite explicit in the flow.
			await deleteOrganizationPage.selectOrganization(0);
			await deleteOrganizationPage.deleteBtnClick();
			await deleteOrganizationPage.confirmBtnExists();
			await deleteOrganizationPage.confirmBtnClick();
		});
	});
});
