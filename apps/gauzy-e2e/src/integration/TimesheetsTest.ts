import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timesheetsPage from '../support/Base/pages/Timesheets.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { TimesheetsPageData } from '../support/Base/pagedata/TimesheetsPageData';

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
		timesheetsPage.selectEmployeeDropdownVisible();
		timesheetsPage.clickSelectEmployeeDropdown();
		timesheetsPage.selectEmployeeFromDropdown(0);
		timesheetsPage.dateInputVisible();
		timesheetsPage.enterDateData();
		timesheetsPage.startTimePickerVisible();
		timesheetsPage.clickStartTimePicker();
		timesheetsPage.selectTimeFromDropdown(0);
		timesheetsPage.endTimePickerVisible();
		timesheetsPage.clickEndTimePicker();
		timesheetsPage.selectTimeFromDropdown(0);
		timesheetsPage.addTimeLogDescriptionVisible();
		timesheetsPage.enterTimeLogDescriptionData(
			TimesheetsPageData.defaultDescription
		);
		timesheetsPage.saveTimeLogButtonVisible();
		timesheetsPage.clickSaveTiemLogButton();
		// timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		// timesheetsPage.clickCloseAddTimeLogPopoverButton();
		// timesheetsPage.viewEmployeeTimeLogButtonVisible();
		// timesheetsPage.clickViewEmployeeTimeLogButton();
		// timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		// timesheetsPage.clickCloseAddTimeLogPopoverButton();
		// timesheetsPage.editEmployeeTimeLogButtonVisible();
		// timesheetsPage.clickEditEmployeeTimeLogButton();
		// timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		// timesheetsPage.clickCloseAddTimeLogPopoverButton();
		// timesheetsPage.deleteEmployeeTimeLogButtonVisible();
		// timesheetsPage.clickDeleteEmployeeTimeLogButton();
		// timesheetsPage.closeAddTimeLogPopoverButtonVisible();
		// timesheetsPage.clickCloseAddTimeLogPopoverButton();
	});
});
