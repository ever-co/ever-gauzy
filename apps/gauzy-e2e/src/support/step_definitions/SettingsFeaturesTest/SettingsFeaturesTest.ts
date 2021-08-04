import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as settingsFeaturesPage from '../../Base/pages/SettingsFeatures.po';
import { SettingsFeaturesPageData } from '../../Base/pagedata/SettingsFeaturesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let checked = 'be.checked';
const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials and visit Settings features page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/settings/features/tenant', { timeout: pageLoadTimeout });
});

// Verify Tenant features
// Task Dashboard features
And('User can see tenant tab button', () => {
	settingsFeaturesPage.tabButtonVisible();
});

When('User click on tenant tab button', () => {
	settingsFeaturesPage.clickTabButton(0);
});

Then('User can see Task dashboard features', () => {
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

// Payment features
And('User can verify Payment features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.managePayment
	);
	settingsFeaturesPage.verifyCheckboxState(3, checked);
});

// Proposal features
And('User can verify Proposal features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProposal
	);
	settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.proposalTemplate
	);
	settingsFeaturesPage.verifyCheckboxState(4, checked);
	settingsFeaturesPage.verifyCheckboxState(5, checked);
});

// Expense features
And('User can verify Expense features', () => {
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

// Invoice features
And('User can verify Invoice features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageInvoice
	);
	settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.invoiceReceived
	);
	settingsFeaturesPage.verifyCheckboxState(9, checked);
	settingsFeaturesPage.verifyCheckboxState(10, checked);
});

// Jobs features
And('User can verify Jobs features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.jobSearch
	);
	settingsFeaturesPage.verifyCheckboxState(11, checked);
});

// Time Activity features
And('user can verify Time Activity features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTimeActivity
	);
	settingsFeaturesPage.verifyCheckboxState(12, checked);
});

// Appointment and Schedule features
And('User can verify Appointment and Schedule features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.employeeAppointment
	);
	settingsFeaturesPage.verifyCheckboxState(13, checked);
});

// Manage Organization features
And('User can verify Manage Organization features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationDetails
	);
	settingsFeaturesPage.verifyTextExist(SettingsFeaturesPageData.helpCenter);
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

// Project features
And('User can verify Project features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProject
	);
	settingsFeaturesPage.verifyCheckboxState(21, checked);
});

// Organization Document features
And('User can verify Organization Document features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationDocument
	);
	settingsFeaturesPage.verifyCheckboxState(22, checked);
});

// Goal and Objective features
And('User can verify Goal and Objective features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageGoals
	);
	settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.goalTimeFrame
	);
	settingsFeaturesPage.verifyCheckboxState(23, checked);
	settingsFeaturesPage.verifyCheckboxState(24, checked);
});

// Users features
And('User can verify Users features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenantUsers
	);
	settingsFeaturesPage.verifyCheckboxState(25, checked);
});

// Apps and Integrations features
And('User can verify Apps and Integrations features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageAvailableApps
	);
	settingsFeaturesPage.verifyCheckboxState(26, checked);
});

// Setting features
And('User can verify Setting features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageSetting
	);
	settingsFeaturesPage.verifyTextExist(SettingsFeaturesPageData.fileStorage);
	settingsFeaturesPage.verifyTextExist(SettingsFeaturesPageData.SMSGateway);
	settingsFeaturesPage.verifyCheckboxState(27, checked);
	settingsFeaturesPage.verifyCheckboxState(28, checked);
	settingsFeaturesPage.verifyCheckboxState(29, checked);
});

// Custom SMTP features
And('User can verify Custom SMTP features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenant
	);
	settingsFeaturesPage.verifyCheckboxState(30, checked);
});

// Time Tracking features
And('User can verify Time Tracking features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.downloadDesktopApp
	);
	settingsFeaturesPage.verifyCheckboxState(31, checked);
});

// Estimate features
And('User can verify Estimate features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEstimate
	);
	settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.estimateReceived
	);
	settingsFeaturesPage.verifyCheckboxState(32, checked);
	settingsFeaturesPage.verifyCheckboxState(33, checked);
});

// Income features
And('User can verify Income features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.createFirstIncome
	);
	settingsFeaturesPage.verifyCheckboxState(34, checked);
});

// Dashboard features
And('User can verify Dashboard features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.goToDashboard
	);
	settingsFeaturesPage.verifyCheckboxState(35, checked);
});

// Sales Pipeline features
And('User can verify Sales Pipeline features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.createSalesPipeline
	);
	settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.salesPipelineDeal
	);
	settingsFeaturesPage.verifyCheckboxState(36, checked);
	settingsFeaturesPage.verifyCheckboxState(37, checked);
});

// Employees features
And('User can verify Employees features', () => {
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

// Timesheet features
And('User can verify Timesheet features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEmployeeTimesheetDaily
	);
	settingsFeaturesPage.verifyCheckboxState(44, checked);
});

// Candidate features
And('User can verify Candidate features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageCandidates
	);
	settingsFeaturesPage.verifyTextExist(SettingsFeaturesPageData.manageInvite);
	settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.manageInterview
	);
	settingsFeaturesPage.verifyCheckboxState(45, checked);
	settingsFeaturesPage.verifyCheckboxState(46, checked);
	settingsFeaturesPage.verifyCheckboxState(47, checked);
});

// Product Inventory features
And('User can verify Product Inventory features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageProductInventory
	);
	settingsFeaturesPage.verifyCheckboxState(48, checked);
});

// Organization Team features
And('User can verify Organization Team features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageOrganizationTeam
	);
	settingsFeaturesPage.verifyCheckboxState(49, checked);
});

// Lead, Customer and Client features
And('User can verify Lead, Customer and Client features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageLeads
	);
	settingsFeaturesPage.verifyCheckboxState(50, checked);
});

// All Report features
And('User can verify All Report features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageExpense
	);
	settingsFeaturesPage.verifyCheckboxState(51, checked);
});

// Organizations features
And('User can verify Organizations features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageTenantOrganizations
	);
	settingsFeaturesPage.verifyCheckboxState(52, checked);
});

// Email History features
And('User can verify Email History features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEmailHistory
	);
	settingsFeaturesPage.verifyTextExist(
		SettingsFeaturesPageData.customEmailTemplate
	);
	settingsFeaturesPage.verifyCheckboxState(53, checked);
	settingsFeaturesPage.verifyCheckboxState(54, checked);
});

// Entity Import and Export features
And('User can verify Entity Import and Export features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageEntity
	);
	settingsFeaturesPage.verifyCheckboxState(55, checked);
});

// Roles and Permissions features
And('User can verify Roles and Permissions features', () => {
	settingsFeaturesPage.verifyMainTextExist(
		SettingsFeaturesPageData.manageRoles
	);
	settingsFeaturesPage.verifyCheckboxState(56, checked);
});
