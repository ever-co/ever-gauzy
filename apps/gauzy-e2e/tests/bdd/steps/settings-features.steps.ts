import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as settingsFeaturesPage from '../../support/pages/SettingsFeatures.po';
import { SettingsFeaturesPageData } from '../../../src/support/Base/pagedata/SettingsFeaturesPageData';

// Converted 1:1 from the plain SettingsFeaturesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts. The module-level `checked` constant and the
// `ensureEnglishLanguage()` pre-normalisation (which ran between login and the first test.step) are
// preserved here at module scope / the start of the first step respectively.

let checked = 'be.checked';

When('I verify the Task Dashboard feature', async () => {
	// A prior test may have left the (DB-persisted) UI language non-English;
	// this spec verifies English feature labels, so normalise it first.
	await settingsFeaturesPage.ensureEnglishLanguage();

	await getPage().goto('/#/pages/settings/features/tenant');
	await settingsFeaturesPage.verifyHeader(SettingsFeaturesPageData.headerText);
	await settingsFeaturesPage.tabButtonVisible();
	await settingsFeaturesPage.clickTabButton(0);
	await settingsFeaturesPage.verifySubheader(
		SettingsFeaturesPageData.subheaderTextTenant
	);
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.taskDashboard
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.teamTaskDashboard
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.myTaskDashboard
	);
	await settingsFeaturesPage.verifyCheckboxState(0, checked);
	await settingsFeaturesPage.verifyCheckboxState(1, checked);
	await settingsFeaturesPage.verifyCheckboxState(2, checked);
});

When('I verify the Manage Payment and Create First Payment features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.managePayment
	);
	await settingsFeaturesPage.verifyCheckboxState(3, checked);
});

When('I verify the Manage Proposal and Register First Proposal features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProposal
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.proposalTemplate
	);
	await settingsFeaturesPage.verifyCheckboxState(4, checked);
	await settingsFeaturesPage.verifyCheckboxState(5, checked);
});

When('I verify the Create First Expense feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.createFirstExpense
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.employeeRecurringExpense
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.organizationRecurringExpenses
	);
	await settingsFeaturesPage.verifyCheckboxState(6, checked);
	await settingsFeaturesPage.verifyCheckboxState(7, checked);
	await settingsFeaturesPage.verifyCheckboxState(8, checked);
});

When('I verify the Manage Invoice and Create First Invoice features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageInvoice
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.invoiceReceived
	);
	await settingsFeaturesPage.verifyCheckboxState(9, checked);
	await settingsFeaturesPage.verifyCheckboxState(10, checked);
});

When('I verify the Job Search and Jobs Matching feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.jobSearch
	);
	await settingsFeaturesPage.verifyCheckboxState(11, checked);
});

When('I verify the Manage Time Activity, Screenshots, App, Visited Sites and Activities feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTimeActivity
	);
	await settingsFeaturesPage.verifyCheckboxState(12, checked);
});

When('I verify the Employee Appointment, Schedules and Book Public Appointment feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.employeeAppointment
	);
	await settingsFeaturesPage.verifyCheckboxState(13, checked);
});

When('I verify the Manage Organization Details, Location and Settings features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationDetails
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.helpCenter
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.organizationEmploymentType
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.organizationDepartment
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.organizationVendor
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.organizationEquipment
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.organizationTag
	);
	await settingsFeaturesPage.verifyCheckboxState(14, checked);
	await settingsFeaturesPage.verifyCheckboxState(15, checked);
	await settingsFeaturesPage.verifyCheckboxState(16, checked);
	await settingsFeaturesPage.verifyCheckboxState(17, checked);
	await settingsFeaturesPage.verifyCheckboxState(18, checked);
	await settingsFeaturesPage.verifyCheckboxState(19, checked);
	await settingsFeaturesPage.verifyCheckboxState(20, checked);
});

When('I verify the Manage Project and Create First Project features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProject
	);
	await settingsFeaturesPage.verifyCheckboxState(21, checked);
});

When('I verify the Manage Organization Document and Create First Document features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationDocument
	);
	await settingsFeaturesPage.verifyCheckboxState(22, checked);
});

When('I verify the Manage Goals and Objectives feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageGoals
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.goalTimeFrame
	);
	await settingsFeaturesPage.verifyCheckboxState(23, checked);
	await settingsFeaturesPage.verifyCheckboxState(24, checked);
});

When('I verify the Manage Tenant Users feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenantUsers
	);
	await settingsFeaturesPage.verifyCheckboxState(25, checked);
});

When('I verify the Manage Available Apps and Integrations feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageAvailableApps
	);
	await settingsFeaturesPage.verifyCheckboxState(26, checked);
});

When('I verify the Manage Setting feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageSetting
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.fileStorage
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.SMSGateway
	);
	await settingsFeaturesPage.verifyCheckboxState(27, checked);
	await settingsFeaturesPage.verifyCheckboxState(28, checked);
	await settingsFeaturesPage.verifyCheckboxState(29, checked);
});

When('I verify the Manage Tenant and Organization Custom SMTP feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenant
	);
	await settingsFeaturesPage.verifyCheckboxState(30, checked);
});

When('I verify the Download Desktop App and Create First Timesheet feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.downloadDesktopApp
	);
	await settingsFeaturesPage.verifyCheckboxState(31, checked);
});

When('I verify the Manage Estimate and Create First Estimate features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEstimate
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.estimateReceived
	);
	await settingsFeaturesPage.verifyCheckboxState(32, checked);
	await settingsFeaturesPage.verifyCheckboxState(33, checked);
});

When('I verify the Create First Income feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.createFirstIncome
	);
	await settingsFeaturesPage.verifyCheckboxState(34, checked);
});

When('I verify the Manage Employee Statistics and Time Tracking Dashboard feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.goToDashboard
	);
	await settingsFeaturesPage.verifyCheckboxState(35, checked);
});

When('I verify the Create Sales Pipeline feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.createSalesPipeline
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.salesPipelineDeal
	);
	await settingsFeaturesPage.verifyCheckboxState(36, checked);
	await settingsFeaturesPage.verifyCheckboxState(37, checked);
});

When('I verify the Manage Employees and Add or Invite Employees features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEmployees
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.employeeApproval
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.employeeLevel
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.employeePosition
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.employeeTimeOff
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.employeeApprovalPolicy
	);
	await settingsFeaturesPage.verifyCheckboxState(38, checked);
	await settingsFeaturesPage.verifyCheckboxState(39, checked);
	await settingsFeaturesPage.verifyCheckboxState(40, checked);
	await settingsFeaturesPage.verifyCheckboxState(41, checked);
	await settingsFeaturesPage.verifyCheckboxState(42, checked);
	await settingsFeaturesPage.verifyCheckboxState(43, checked);
});

When('I verify the Manage Employee Timesheet feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEmployeeTimesheetDaily
	);
	await settingsFeaturesPage.verifyCheckboxState(44, checked);
});

When('I verify the Manage Candidates, Interviews and Invites features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageCandidates
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.manageInvite
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.manageInterview
	);
	await settingsFeaturesPage.verifyCheckboxState(45, checked);
	await settingsFeaturesPage.verifyCheckboxState(46, checked);
	await settingsFeaturesPage.verifyCheckboxState(47, checked);
});

When('I verify the Manage Product Inventory and Create First Product features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProductInventory
	);
	await settingsFeaturesPage.verifyCheckboxState(48, checked);
});

When('I verify the Manage Organization Team and Create First Team features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationTeam
	);
	await settingsFeaturesPage.verifyCheckboxState(49, checked);
});

When('I verify the Manage Leads, Customers and Clients feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageLeads
	);
	await settingsFeaturesPage.verifyCheckboxState(50, checked);
});

When('I verify the Manage Expense and Reports feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageExpense
	);
	await settingsFeaturesPage.verifyCheckboxState(51, checked);
});

When('I verify the Manage Tenant Organizations feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenantOrganizations
	);
	await settingsFeaturesPage.verifyCheckboxState(52, checked);
});

When('I verify the Manage Email History feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEmailHistory
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.customEmailTemplate
	);
	await settingsFeaturesPage.verifyCheckboxState(53, checked);
	await settingsFeaturesPage.verifyCheckboxState(54, checked);
});

When('I verify the Manage Entity Import and Export feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEntity
	);
	await settingsFeaturesPage.verifyCheckboxState(55, checked);
});

When('I verify the Manage Roles and Permissions feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageRoles
	);
	await settingsFeaturesPage.verifyCheckboxState(56, checked);
});
