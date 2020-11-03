import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timesheetsPage from '../support/Base/pages/Timesheets.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

describe('Timesheets test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});
	it('Should be able to add time', () => {
		cy.visit('/#/pages/employees/timesheets/daily');
		timesheetsPage.addTimeButtonVisible();
		timesheetsPage.clickAddTimeButton();
		timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		timesheetsPage.clickCloseAddTimeLogPopoverButton();
		timesheetsPage.viewEmployeeTimeLogButtonVisible();
		timesheetsPage.clickViewEmployeeTimeLogButton();
		timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		timesheetsPage.clickCloseAddTimeLogPopoverButton();
		timesheetsPage.editEmployeeTimeLogButtonVisible();
		timesheetsPage.clickEditEmployeeTimeLogButton();
		timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		timesheetsPage.clickCloseAddTimeLogPopoverButton();
		timesheetsPage.deleteEmployeeTimeLogButtonVisible();
		timesheetsPage.clickDeleteEmployeeTimeLogButton();
		timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		timesheetsPage.clickCloseAddTimeLogPopoverButton();
	});
});
