import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as reportsPage from './support/pages/Reports.po';
import { ReportsPageData } from '../src/support/Base/pagedata/ReportsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let notChecked = 'not.checked';

test.describe('Reports test', () => {
	test('Reports test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Time Tracking', async () => {
			await getPage().goto('/#/pages/reports/all');
			await reportsPage.verifyHeader(ReportsPageData.header);
			await reportsPage.verifySubheader(ReportsPageData.timeTracking);
			await reportsPage.verifyTitle(ReportsPageData.timeAndActivity);
			await reportsPage.verifyTitle(ReportsPageData.weekly);
			await reportsPage.verifyTitle(ReportsPageData.appsUrls);
			await reportsPage.verifyTitle(ReportsPageData.manualTimeEdits);
			await reportsPage.verifyTitle(ReportsPageData.expense);
			await reportsPage.verifyCheckboxState(0, notChecked);
			await reportsPage.verifyCheckboxState(1, notChecked);
			await reportsPage.verifyCheckboxState(2, notChecked);
			await reportsPage.verifyCheckboxState(3, notChecked);
			await reportsPage.verifyCheckboxState(4, notChecked);
		});

		await test.step('Payments', async () => {
			await reportsPage.verifySubheader(ReportsPageData.payments);
			await reportsPage.verifyTitle(ReportsPageData.amountsOwed);
			await reportsPage.verifyTitle(ReportsPageData.payments);
			await reportsPage.verifyCheckboxState(5, notChecked);
			await reportsPage.verifyCheckboxState(6, notChecked);
		});

		await test.step('Time Off', async () => {
			await reportsPage.verifySubheader(ReportsPageData.timeOff);
			await reportsPage.verifyTitle(ReportsPageData.weeklyLimits);
			await reportsPage.verifyTitle(ReportsPageData.dailyLimits);
			await reportsPage.verifyCheckboxState(7, notChecked);
			await reportsPage.verifyCheckboxState(8, notChecked);
		});

		await test.step('Payments', async () => {
			await reportsPage.verifySubheader(ReportsPageData.invoicing);
			await reportsPage.verifyTitle(ReportsPageData.projectBudgets);
			await reportsPage.verifyTitle(ReportsPageData.clientBudgets);
			await reportsPage.verifyCheckboxState(9, notChecked);
			await reportsPage.verifyCheckboxState(10, notChecked);
		});
	});
});
