import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as dangerZonePage from '../support/Base/pages/DangerZone.po';
import { DangerZonePageData } from '../support/Base/pagedata/DangerZonePageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Danger zone Test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should able to verify danger zone', () => {
		cy.visit('/#/pages/settings/danger-zone');
		dangerZonePage.verifyHeaderTextExist(DangerZonePageData.headerText);
		dangerZonePage.deleteButtonVisible();
		dangerZonePage.clickDeleteButton();
		dangerZonePage.verifyDeleteTextExist(
			DangerZonePageData.confirmDeleteText
		);
		dangerZonePage.deleteInputVisible();
		dangerZonePage.enterInputData(DangerZonePageData.deleteUserText);
		dangerZonePage.confirmDeleteButtonVisible();
		dangerZonePage.cancelButtonVisible();
		dangerZonePage.clickCancelButton();
		dangerZonePage.verifyDeleteButtonText(DangerZonePageData.buttonText);
	});
});
