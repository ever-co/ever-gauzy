import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as settingsFeaturesPage from './support/pages/SettingsFeatures.po';
import { SettingsFeaturesPageData } from '../src/support/Base/pagedata/SettingsFeaturesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let checked = 'be.checked';

test.describe('Verify settings features', () => {
	test('Verify settings features', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		// A prior test may have left the (DB-persisted) UI language non-English;
		// this spec verifies English feature labels, so normalise it first.
		await settingsFeaturesPage.ensureEnglishLanguage();

		await test.step('Task Dashboard', async () => {
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

		await test.step('Manage Payment, Create First Payment', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.managePayment
			);
			await settingsFeaturesPage.verifyCheckboxState(3, checked);
		});

		await test.step('Manage Proposal, Register First Proposal', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageProposal
			);
			await settingsFeaturesPage.verifyTextExist(
				SettingsFeaturesPageData.proposalTemplate
			);
			await settingsFeaturesPage.verifyCheckboxState(4, checked);
			await settingsFeaturesPage.verifyCheckboxState(5, checked);
		});

		await test.step('Create First Expense', async () => {
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

		await test.step('Manage Invoice, Create First Invoice', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageInvoice
			);
			await settingsFeaturesPage.verifyTextExist(
				SettingsFeaturesPageData.invoiceReceived
			);
			await settingsFeaturesPage.verifyCheckboxState(9, checked);
			await settingsFeaturesPage.verifyCheckboxState(10, checked);
		});

		await test.step('Job Search & Jobs Matching', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.jobSearch
			);
			await settingsFeaturesPage.verifyCheckboxState(11, checked);
		});

		await test.step('Manage Time Activity, Screenshots, App, Visited Sites, Activities', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageTimeActivity
			);
			await settingsFeaturesPage.verifyCheckboxState(12, checked);
		});

		await test.step('Employee Appointment, Schedules & Book Public Appointment', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.employeeAppointment
			);
			await settingsFeaturesPage.verifyCheckboxState(13, checked);
		});

		await test.step('Manage Organization Details, Location and Settings', async () => {
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

		await test.step('Manage Project, Create First Project', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageProject
			);
			await settingsFeaturesPage.verifyCheckboxState(21, checked);
		});

		await test.step('Manage Organization Document, Create First Document', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageOrganizationDocument
			);
			await settingsFeaturesPage.verifyCheckboxState(22, checked);
		});

		await test.step('Manage Goals and Objectives', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageGoals
			);
			await settingsFeaturesPage.verifyTextExist(
				SettingsFeaturesPageData.goalTimeFrame
			);
			await settingsFeaturesPage.verifyCheckboxState(23, checked);
			await settingsFeaturesPage.verifyCheckboxState(24, checked);
		});

		await test.step('Manage Tenant Users', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageTenantUsers
			);
			await settingsFeaturesPage.verifyCheckboxState(25, checked);
		});

		await test.step('Manage Available Apps & Integrations Like Upwork & Hubstaff', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageAvailableApps
			);
			await settingsFeaturesPage.verifyCheckboxState(26, checked);
		});

		await test.step('Manage Setting', async () => {
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

		await test.step('Manage Tenant & Organization Custom SMTP', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageTenant
			);
			await settingsFeaturesPage.verifyCheckboxState(30, checked);
		});

		await test.step('Download Desktop App, Create First Timesheet', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.downloadDesktopApp
			);
			await settingsFeaturesPage.verifyCheckboxState(31, checked);
		});

		await test.step('Manage Estimate, Create First Estimate', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageEstimate
			);
			await settingsFeaturesPage.verifyTextExist(
				SettingsFeaturesPageData.estimateReceived
			);
			await settingsFeaturesPage.verifyCheckboxState(32, checked);
			await settingsFeaturesPage.verifyCheckboxState(33, checked);
		});

		await test.step('Create First Income', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.createFirstIncome
			);
			await settingsFeaturesPage.verifyCheckboxState(34, checked);
		});

		await test.step('Go to dashboard, Manage Employee Statistics, Time Tracking Dashboard', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.goToDashboard
			);
			await settingsFeaturesPage.verifyCheckboxState(35, checked);
		});

		await test.step('Create Sales Pipeline', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.createSalesPipeline
			);
			await settingsFeaturesPage.verifyTextExist(
				SettingsFeaturesPageData.salesPipelineDeal
			);
			await settingsFeaturesPage.verifyCheckboxState(36, checked);
			await settingsFeaturesPage.verifyCheckboxState(37, checked);
		});

		await test.step('Manage Employees, Add or Invite Employees', async () => {
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

		await test.step('Manage Employee Timesheet Daily, Weekly, Calendar, Create First Timesheet', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageEmployeeTimesheetDaily
			);
			await settingsFeaturesPage.verifyCheckboxState(44, checked);
		});

		await test.step('Manage Candidates, Interviews & Invites', async () => {
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

		await test.step('Manage Product Inventory, Create First Product', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageProductInventory
			);
			await settingsFeaturesPage.verifyCheckboxState(48, checked);
		});

		await test.step('Manage Organization Team, Create First Team', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageOrganizationTeam
			);
			await settingsFeaturesPage.verifyCheckboxState(49, checked);
		});

		await test.step('Manage Leads, Customers and Clients, Create First Customer/Clients', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageLeads
			);
			await settingsFeaturesPage.verifyCheckboxState(50, checked);
		});

		await test.step('Manage Expense, Weekly, Time & Activity and etc reports', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageExpense
			);
			await settingsFeaturesPage.verifyCheckboxState(51, checked);
		});

		await test.step('Manage Tenant Organizations', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageTenantOrganizations
			);
			await settingsFeaturesPage.verifyCheckboxState(52, checked);
		});

		await test.step('Manage Email History', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageEmailHistory
			);
			await settingsFeaturesPage.verifyTextExist(
				SettingsFeaturesPageData.customEmailTemplate
			);
			await settingsFeaturesPage.verifyCheckboxState(53, checked);
			await settingsFeaturesPage.verifyCheckboxState(54, checked);
		});

		await test.step('Manage Entity Import and Export', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageEntity
			);
			await settingsFeaturesPage.verifyCheckboxState(55, checked);
		});

		await test.step('Manage Roles & Permissions', async () => {
			await settingsFeaturesPage.verifyMainTextExist(
				SettingsFeaturesPageData.manageRoles
			);
			await settingsFeaturesPage.verifyCheckboxState(56, checked);
		});
	});
});
