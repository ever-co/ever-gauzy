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

// Every feature's master toggle and each of its sub-feature checkboxes is asserted by NAME: the
// feature group is located by its description line and the sub-feature by its label. The checks
// used to be global indexes into every `input.native-input` on the page (shifted by one for the
// Quick Settings theme switch), which silently depended on the order the API returns the catalogue
// in (FeatureService.getParentFeatures orders by createdAt, and the seed inserts the whole catalogue
// in one batch). On stage d365fbe9e6 the page lists Dashboard, Time Tracking, Estimate, ... first,
// then Documents and the commerce flags, so every old index pointed at a different feature than the
// step names. Same 57 toggles as before (32 features + 25 sub-features), each one now bound to the
// feature the step names.
const checked = 'be.checked';

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
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.taskDashboard, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.taskDashboard,
		SettingsFeaturesPageData.teamTaskDashboard,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.taskDashboard,
		SettingsFeaturesPageData.myTaskDashboard,
		checked
	);
});

When('I verify the Manage Payment and Create First Payment features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.managePayment
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.managePayment, checked);
});

When('I verify the Manage Proposal and Register First Proposal features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProposal
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.proposalTemplate
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageProposal, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageProposal,
		SettingsFeaturesPageData.proposalTemplate,
		checked
	);
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
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.createFirstExpense, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.createFirstExpense,
		SettingsFeaturesPageData.employeeRecurringExpense,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.createFirstExpense,
		SettingsFeaturesPageData.organizationRecurringExpenses,
		checked
	);
});

When('I verify the Manage Invoice and Create First Invoice features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageInvoice
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.invoiceReceived
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageInvoice, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageInvoice,
		SettingsFeaturesPageData.invoiceReceived,
		checked
	);
});

When('I verify the Job Search and Jobs Matching feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.jobSearch
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.jobSearch, checked);
});

When('I verify the Manage Time Activity, Screenshots, App, Visited Sites and Activities feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTimeActivity
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageTimeActivity, checked);
});

When('I verify the Employee Appointment, Schedules and Book Public Appointment feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.employeeAppointment
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.employeeAppointment, checked);
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
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageOrganizationDetails, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageOrganizationDetails,
		SettingsFeaturesPageData.helpCenter,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageOrganizationDetails,
		SettingsFeaturesPageData.organizationEmploymentType,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageOrganizationDetails,
		SettingsFeaturesPageData.organizationDepartment,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageOrganizationDetails,
		SettingsFeaturesPageData.organizationVendor,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageOrganizationDetails,
		SettingsFeaturesPageData.organizationEquipment,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageOrganizationDetails,
		SettingsFeaturesPageData.organizationTag,
		checked
	);
});

When('I verify the Manage Project and Create First Project features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProject
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageProject, checked);
});

When('I verify the Manage Organization Document and Create First Document features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationDocument
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageOrganizationDocument, checked);
});

When('I verify the Manage Goals and Objectives feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageGoals
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.goalTimeFrame
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageGoals, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageGoals,
		SettingsFeaturesPageData.goalTimeFrame,
		checked
	);
});

When('I verify the Manage Tenant Users feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenantUsers
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageTenantUsers, checked);
});

When('I verify the Manage Available Apps and Integrations feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageAvailableApps
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageAvailableApps, checked);
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
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageSetting, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageSetting,
		SettingsFeaturesPageData.fileStorage,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageSetting,
		SettingsFeaturesPageData.SMSGateway,
		checked
	);
});

When('I verify the Manage Tenant and Organization Custom SMTP feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenant
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageTenant, checked);
});

When('I verify the Download Desktop App and Create First Timesheet feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.downloadDesktopApp
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.downloadDesktopApp, checked);
});

When('I verify the Manage Estimate and Create First Estimate features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEstimate
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.estimateReceived
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageEstimate, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageEstimate,
		SettingsFeaturesPageData.estimateReceived,
		checked
	);
});

When('I verify the Create First Income feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.createFirstIncome
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.createFirstIncome, checked);
});

When('I verify the Manage Employee Statistics and Time Tracking Dashboard feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.goToDashboard
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.goToDashboard, checked);
});

When('I verify the Create Sales Pipeline feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.createSalesPipeline
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.salesPipelineDeal
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.createSalesPipeline, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.createSalesPipeline,
		SettingsFeaturesPageData.salesPipelineDeal,
		checked
	);
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
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageEmployees, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageEmployees,
		SettingsFeaturesPageData.employeeApproval,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageEmployees,
		SettingsFeaturesPageData.employeeLevel,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageEmployees,
		SettingsFeaturesPageData.employeePosition,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageEmployees,
		SettingsFeaturesPageData.employeeTimeOff,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageEmployees,
		SettingsFeaturesPageData.employeeApprovalPolicy,
		checked
	);
});

When('I verify the Manage Employee Timesheet feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEmployeeTimesheetDaily
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageEmployeeTimesheetDaily, checked);
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
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageCandidates, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageCandidates,
		SettingsFeaturesPageData.manageInvite,
		checked
	);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageCandidates,
		SettingsFeaturesPageData.manageInterview,
		checked
	);
});

When('I verify the Manage Product Inventory and Create First Product features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProductInventory
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageProductInventory, checked);
});

When('I verify the Manage Organization Team and Create First Team features', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationTeam
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageOrganizationTeam, checked);
});

When('I verify the Manage Leads, Customers and Clients feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageLeads
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageLeads, checked);
});

When('I verify the Manage Expense and Reports feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageExpense
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageExpense, checked);
});

When('I verify the Manage Tenant Organizations feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenantOrganizations
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageTenantOrganizations, checked);
});

When('I verify the Manage Email History feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEmailHistory
	);
	await settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.customEmailTemplate
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageEmailHistory, checked);
	await settingsFeaturesPage.verifySubFeatureState(
		SettingsFeaturesPageData.manageEmailHistory,
		SettingsFeaturesPageData.customEmailTemplate,
		checked
	);
});

When('I verify the Manage Entity Import and Export feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEntity
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageEntity, checked);
});

When('I verify the Manage Roles and Permissions feature', async () => {
	await settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageRoles
	);
	await settingsFeaturesPage.verifyFeatureState(SettingsFeaturesPageData.manageRoles, checked);
});
