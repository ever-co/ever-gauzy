import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as reportsPage from '../../support/pages/Reports.po';
import { ReportsPageData } from '../../../src/support/Base/pagedata/ReportsPageData';

// Converted 1:1 from the plain ReportsTest.spec.ts: the single test() -> one Scenario, each test.step()
// -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is identical to
// the already-CI-tested spec. The `Given I am logged in as the default user` Background step is defined
// once in common.steps.ts.

// Seeded ReportOrganization rows default to isEnabled=true (report-organization.entity.ts), and the
// API derives showInMenu from those rows, so every report toggle renders CHECKED in the e2e org.
let checked = 'be.checked';

When('I verify the time tracking reports', async () => {
	await getPage().goto('/#/pages/reports/all');
	await reportsPage.verifyHeader(ReportsPageData.header);
	await reportsPage.verifySubheader(ReportsPageData.timeTracking);
	await reportsPage.verifyTitle(ReportsPageData.timeAndActivity);
	await reportsPage.verifyTitle(ReportsPageData.weekly);
	await reportsPage.verifyTitle(ReportsPageData.appsUrls);
	await reportsPage.verifyTitle(ReportsPageData.manualTimeEdits);
	await reportsPage.verifyTitle(ReportsPageData.expense);
	await reportsPage.verifyCheckboxState(0, checked);
	await reportsPage.verifyCheckboxState(1, checked);
	await reportsPage.verifyCheckboxState(2, checked);
	await reportsPage.verifyCheckboxState(3, checked);
	await reportsPage.verifyCheckboxState(4, checked);
});

When('I verify the payments reports', async () => {
	await reportsPage.verifySubheader(ReportsPageData.payments);
	await reportsPage.verifyTitle(ReportsPageData.amountsOwed);
	await reportsPage.verifyTitle(ReportsPageData.payments);
	await reportsPage.verifyCheckboxState(5, checked);
	await reportsPage.verifyCheckboxState(6, checked);
});

When('I verify the time off reports', async () => {
	await reportsPage.verifySubheader(ReportsPageData.timeOff);
	await reportsPage.verifyTitle(ReportsPageData.weeklyLimits);
	await reportsPage.verifyTitle(ReportsPageData.dailyLimits);
	await reportsPage.verifyCheckboxState(7, checked);
	await reportsPage.verifyCheckboxState(8, checked);
});

When('I verify the invoicing reports', async () => {
	await reportsPage.verifySubheader(ReportsPageData.invoicing);
	await reportsPage.verifyTitle(ReportsPageData.projectBudgets);
	await reportsPage.verifyTitle(ReportsPageData.clientBudgets);
	await reportsPage.verifyCheckboxState(9, checked);
	await reportsPage.verifyCheckboxState(10, checked);
});
