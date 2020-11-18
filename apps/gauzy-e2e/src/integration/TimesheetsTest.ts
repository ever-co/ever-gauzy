import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as timesheetsPage from '../support/Base/pages/Timesheets.po';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { TimesheetsPageData } from '../support/Base/pagedata/TimesheetsPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';

describe('Timesheets test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});
	it('Should be able to add time', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		cy.visit('/#/pages/employees/timesheets/daily');
		timesheetsPage.addTimeButtonVisible();
		timesheetsPage.clickAddTimeButton();
		timesheetsPage.selectEmployeeDropdownVisible();
		timesheetsPage.clickSelectEmployeeDropdown();
		timesheetsPage.selectEmployeeFromDropdown(0);
		timesheetsPage.dateInputVisible();
		timesheetsPage.enterDateData();
		timesheetsPage.clickKeyboardButtonByKeyCode(9);
		timesheetsPage.selectProjectDropdownVisible();
		timesheetsPage.clickSelectProjectDropdown();
		timesheetsPage.selectProjectOptionDropdown(
			TimesheetsPageData.defaultProjectName
		);
		timesheetsPage.addTimeLogDescriptionVisible();
		timesheetsPage.enterTimeLogDescriptionData(
			TimesheetsPageData.defaultDescription
		);
		timesheetsPage.saveTimeLogButtonVisible();
		timesheetsPage.clickSaveTiemLogButton();
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
