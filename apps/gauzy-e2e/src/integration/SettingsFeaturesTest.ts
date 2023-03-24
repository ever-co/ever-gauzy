import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as settingsFeaturesPage from '../support/Base/pages/SettingsFeatures.po';
import { SettingsFeaturesPageData } from '../support/Base/pagedata/SettingsFeaturesPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let checked = 'be.checked';

describe('Verify settings features', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});
	it('Task Dashboard', () => {
		cy.visit('/#/pages/settings/features/tenant');
		settingsFeaturesPage.verifyHeader(SettingsFeaturesPageData.headerText);
		settingsFeaturesPage.tabButtonVisible();
		settingsFeaturesPage.clickTabButton(0);
		settingsFeaturesPage.verifySubheader(
			SettingsFeaturesPageData.subheaderTextTenant
		);
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.taskDashboard
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.teamTaskDashboard
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.myTaskDashboard
		);
		settingsFeaturesPage.verifyCheckboxState(0, checked);
		settingsFeaturesPage.verifyCheckboxState(1, checked);
		settingsFeaturesPage.verifyCheckboxState(2, checked);
	});
	it('Manage Payment, Create First Payment', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.managePayment
		);
		settingsFeaturesPage.verifyCheckboxState(3, checked);
	});
	it('Manage Proposal, Register First Proposal', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageProposal
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.proposalTemplate
		);
		settingsFeaturesPage.verifyCheckboxState(4, checked);
		settingsFeaturesPage.verifyCheckboxState(5, checked);
	});
	it('Create First Expense', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.createFirstExpense
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.employeeRecurringExpense
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.organizationRecurringExpenses
		);
		settingsFeaturesPage.verifyCheckboxState(6, checked);
		settingsFeaturesPage.verifyCheckboxState(7, checked);
		settingsFeaturesPage.verifyCheckboxState(8, checked);
	});
	it('Manage Invoice, Create First Invoice', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageInvoice
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.invoiceReceived
		);
		settingsFeaturesPage.verifyCheckboxState(9, checked);
		settingsFeaturesPage.verifyCheckboxState(10, checked);
	});
	it('Job Search & Jobs Matching', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.jobSearch
		);
		settingsFeaturesPage.verifyCheckboxState(11, checked);
	});
	it('Manage Time Activity, Screenshots, App, Visited Sites, Activities', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageTimeActivity
		);
		settingsFeaturesPage.verifyCheckboxState(12, checked);
	});
	it('Employee Appointment, Schedules & Book Public Appointment', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.employeeAppointment
		);
		settingsFeaturesPage.verifyCheckboxState(13, checked);
	});
	it('Manage Organization Details, Location and Settings', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageOrganizationDetails
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.helpCenter
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.organizationEmploymentType
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.organizationDepartment
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.organizationVendor
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.organizationEquipment
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.organizationTag
		);
		settingsFeaturesPage.verifyCheckboxState(14, checked);
		settingsFeaturesPage.verifyCheckboxState(15, checked);
		settingsFeaturesPage.verifyCheckboxState(16, checked);
		settingsFeaturesPage.verifyCheckboxState(17, checked);
		settingsFeaturesPage.verifyCheckboxState(18, checked);
		settingsFeaturesPage.verifyCheckboxState(19, checked);
		settingsFeaturesPage.verifyCheckboxState(20, checked);
	});
	it('Manage Project, Create First Project', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageProject
		);
		settingsFeaturesPage.verifyCheckboxState(21, checked);
	});
	it('Manage Organization Document, Create First Document', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageOrganizationDocument
		);
		settingsFeaturesPage.verifyCheckboxState(22, checked);
	});
	it('Manage Goals and Objectives', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageGoals
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.goalTimeFrame
		);
		settingsFeaturesPage.verifyCheckboxState(23, checked);
		settingsFeaturesPage.verifyCheckboxState(24, checked);
	});
	it('Manage Tenant Users', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageTenantUsers
		);
		settingsFeaturesPage.verifyCheckboxState(25, checked);
	});
	it('Manage Available Apps & Integrations Like Upwork & Hubstaff', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageAvailableApps
		);
		settingsFeaturesPage.verifyCheckboxState(26, checked);
	});
	it('Manage Setting', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageSetting
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.fileStorage
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.SMSGateway
		);
		settingsFeaturesPage.verifyCheckboxState(27, checked);
		settingsFeaturesPage.verifyCheckboxState(28, checked);
		settingsFeaturesPage.verifyCheckboxState(29, checked);
	});
	it('Manage Tenant & Organization Custom SMTP', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageTenant
		);
		settingsFeaturesPage.verifyCheckboxState(30, checked);
	});
	it('Download Desktop App, Create First Timesheet', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.downloadDesktopApp
		);
		settingsFeaturesPage.verifyCheckboxState(31, checked);
	});
	it('Manage Estimate, Create First Estimate', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageEstimate
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.estimateReceived
		);
		settingsFeaturesPage.verifyCheckboxState(32, checked);
		settingsFeaturesPage.verifyCheckboxState(33, checked);
	});
	it('Create First Income', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.createFirstIncome
		);
		settingsFeaturesPage.verifyCheckboxState(34, checked);
	});
	it('Go to dashboard, Manage Employee Statistics, Time Tracking Dashboard', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.goToDashboard
		);
		settingsFeaturesPage.verifyCheckboxState(35, checked);
	});
	it('Create Sales Pipeline', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.createSalesPipeline
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.salesPipelineDeal
		);
		settingsFeaturesPage.verifyCheckboxState(36, checked);
		settingsFeaturesPage.verifyCheckboxState(37, checked);
	});
	it('Manage Employees, Add or Invite Employees', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageEmployees
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.employeeApproval
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.employeeLevel
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.employeePosition
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.employeeTimeOff
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.employeeApprovalPolicy
		);
		settingsFeaturesPage.verifyCheckboxState(38, checked);
		settingsFeaturesPage.verifyCheckboxState(39, checked);
		settingsFeaturesPage.verifyCheckboxState(40, checked);
		settingsFeaturesPage.verifyCheckboxState(41, checked);
		settingsFeaturesPage.verifyCheckboxState(42, checked);
		settingsFeaturesPage.verifyCheckboxState(43, checked);
	});
	it('Manage Employee Timesheet Daily, Weekly, Calendar, Create First Timesheet', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageEmployeeTimesheetDaily
		);
		settingsFeaturesPage.verifyCheckboxState(44, checked);
	});
	it('Manage Candidates, Interviews & Invites', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageCandidates
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.manageInvite
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.manageInterview
		);
		settingsFeaturesPage.verifyCheckboxState(45, checked);
		settingsFeaturesPage.verifyCheckboxState(46, checked);
		settingsFeaturesPage.verifyCheckboxState(47, checked);
	});
	it('Manage Product Inventory, Create First Product', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageProductInventory
		);
		settingsFeaturesPage.verifyCheckboxState(48, checked);
	});
	it('Manage Organization Team, Create First Team', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageOrganizationTeam
		);
		settingsFeaturesPage.verifyCheckboxState(49, checked);
	});
	it('Manage Leads, Customers and Clients, Create First Customer/Clients', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageLeads
		);
		settingsFeaturesPage.verifyCheckboxState(50, checked);
	});
	it('Manage Expense, Weekly, Time & Activity and etc reports', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageExpense
		);
		settingsFeaturesPage.verifyCheckboxState(51, checked);
	});
	it('Manage Tenant Organizations', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageTenantOrganizations
		);
		settingsFeaturesPage.verifyCheckboxState(52, checked);
	});
	it('Manage Email History', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageEmailHistory
		);
		settingsFeaturesPage.verifyTextExist(
			SettingsFeaturesPageData.customEmailTemplate
		);
		settingsFeaturesPage.verifyCheckboxState(53, checked);
		settingsFeaturesPage.verifyCheckboxState(54, checked);
	});
	it('Manage Entity Import and Export', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageEntity
		);
		settingsFeaturesPage.verifyCheckboxState(55, checked);
	});
	it('Manage Roles & Permissions', () => {
		settingsFeaturesPage.verifyMainTextExist(
			SettingsFeaturesPageData.manageRoles
		);
		settingsFeaturesPage.verifyCheckboxState(56, checked);
	});
});
