import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as reportsPage from '../support/Base/pages/Reports.po';
import { ReportsPageData } from '../support/Base/pagedata/ReportsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let notChecked = 'not.checked';

describe('Reports test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Time Tracking', () => {
		cy.visit('/#/pages/reports/all');
		reportsPage.verifyHeader(ReportsPageData.header);
		reportsPage.verifySubheader(ReportsPageData.timeTracking);
		reportsPage.verifyTitle(ReportsPageData.timeAndActivity);
		reportsPage.verifyTitle(ReportsPageData.weekly);
		reportsPage.verifyTitle(ReportsPageData.appsUrls);
		reportsPage.verifyTitle(ReportsPageData.manualTimeEdits);
		reportsPage.verifyTitle(ReportsPageData.expense);
		reportsPage.verifyCheckboxState(0, notChecked);
		reportsPage.verifyCheckboxState(1, notChecked);
		reportsPage.verifyCheckboxState(2, notChecked);
		reportsPage.verifyCheckboxState(3, notChecked);
		reportsPage.verifyCheckboxState(4, notChecked);
	});
	it('Payments', () => {
		reportsPage.verifySubheader(ReportsPageData.payments);
		reportsPage.verifyTitle(ReportsPageData.amountsOwed);
		reportsPage.verifyTitle(ReportsPageData.payments);
		reportsPage.verifyCheckboxState(5, notChecked);
		reportsPage.verifyCheckboxState(6, notChecked);
	});
	it('Time Off', () => {
		reportsPage.verifySubheader(ReportsPageData.timeOff);
		reportsPage.verifyTitle(ReportsPageData.weeklyLimits);
		reportsPage.verifyTitle(ReportsPageData.dailyLimits);
		reportsPage.verifyCheckboxState(7, notChecked);
		reportsPage.verifyCheckboxState(8, notChecked);
	});
	it('Payments', () => {
		reportsPage.verifySubheader(ReportsPageData.invoicing);
		reportsPage.verifyTitle(ReportsPageData.projectBudgets);
		reportsPage.verifyTitle(ReportsPageData.clientBudgets);
		reportsPage.verifyCheckboxState(9, notChecked);
		reportsPage.verifyCheckboxState(10, notChecked);
	});
});
