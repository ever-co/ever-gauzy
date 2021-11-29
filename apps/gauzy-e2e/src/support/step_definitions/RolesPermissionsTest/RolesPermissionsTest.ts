import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import { RolesPermissionsPageData } from '../../Base/pagedata/RolesPermissionsPageData';
import * as rolesPermissionsPage from '../../Base/pages/RolesPermissions.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let checked = 'be.checked';
let notChecked = 'not.checked';

// Login with email
Given('Login with default credentials and visit Settings roles page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/settings/roles', { timeout: pageLoadTimeout });
});

// Super admin roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Super admin role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.superAdmin
	);
});

And('User can verify Super admin general roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAdminDashboard, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPayments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeletePayments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmployeeExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteEmployeeExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteIncomes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllIncomes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalsRegister, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalsPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalTemplatesPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalTemplates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInvites, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateResendDeleteInvites, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOff, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequest, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequest, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessPrivateProjects, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeInTimesheet, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInvoices, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInvoicesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEstimates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditEstimatesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllCandidatesDocuments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTask, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterview, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterviewers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteCandidateFeedback, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventory, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProduct, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteTags, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmails, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmailsTemplates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationHelpCenter, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSalesPipelines, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSalesPipelines, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ApproveTimesheet, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditSprints, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSprints, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditProjects, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContacts, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewContacts, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTeams, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContracts, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEventTypes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessTimeTracker, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGallery, checked);
});

And('User can verify Super admin administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInventoryGallery, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipment, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipment, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharing, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipmentSharing, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestMakeEquipmentMake, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestApproveEquipment, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategories, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationProductCategories, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllAccountingTemplates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEmployees, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationEmployees, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationCandidates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationCandidates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationUsers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationUsers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllOrganizations, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteAllOrganizations, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedEmployee, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedCandidate, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedOrganization, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeRolesAndPermissions, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSuperAdminUsers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationPublicPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventoryAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProductAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicyAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicyAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequestAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequestAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.TenantAddUserToOrganization, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewIntegrations, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewFileStorage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPaymentGateway, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSMSGateway, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewCustomSMTP, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewImportExport, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobEmployees, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobMatching, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGalleryAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharingAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypesAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategoriesAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.MigrateIntoGauzyCloud, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAccount, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAllData, checked);
});

// Admin roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Admin role from dropdown options', () => {
	rolesPermissionsPage.selectRoleByIndex(1);
});

And('User can verify Admin general roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAdminDashboard, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPayments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeletePayments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmployeeExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteEmployeeExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteIncomes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllIncomes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalsRegister, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalsPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalTemplatesPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalTemplates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInvites, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateResendDeleteInvites, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOff, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequest, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequest, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessPrivateProjects, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeInTimesheet, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInvoices, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInvoicesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEstimates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditEstimatesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllCandidatesDocuments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTask, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterview, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterviewers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteCandidateFeedback, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventory, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProduct, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteTags, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmails, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmailsTemplates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationHelpCenter, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSalesPipelines, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSalesPipelines, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ApproveTimesheet, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditSprints, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSprints, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditProjects, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContacts, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewContacts, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTeams, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContracts, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEventTypes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessTimeTracker, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGallery, checked);
});

And('User can verify Admin administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInventoryGallery, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipment, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharing, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipmentSharing, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestMakeEquipmentMake, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestApproveEquipment, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategories, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationProductCategories, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllAccountingTemplates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEmployees, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationEmployees, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationCandidates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationCandidates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationUsers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationUsers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllOrganizations, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteAllOrganizations, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedEmployee, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedCandidate, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedOrganization, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeRolesAndPermissions, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSuperAdminUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationPublicPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventoryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProductAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicyAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicyAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequestAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequestAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.TenantAddUserToOrganization, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewIntegrations, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewFileStorage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPaymentGateway, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSMSGateway, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewCustomSMTP, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewImportExport, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobEmployees, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobMatching, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGalleryAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharingAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypesAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategoriesAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.MigrateIntoGauzyCloud, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAccount, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAllData, checked);
});

// Data Entry roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Data Entry role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.dataEntry
	);
});

And('User can verify Data Entry general roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAdminDashboard, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPayments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeletePayments, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteIncomes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllIncomes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalsRegister, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalsPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalTemplatesPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateResendDeleteInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOff, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessPrivateProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeInTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInvoices, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInvoicesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEstimates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditEstimatesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllCandidatesDocuments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTask, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterview, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterviewers, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteCandidateFeedback, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventory, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProduct, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteTags, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmails, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmailsTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationHelpCenter, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ApproveTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTeams, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContracts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEventTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessTimeTracker, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGallery, notChecked);
});

And('User can verify Data Entry administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInventoryGallery, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestMakeEquipmentMake, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestApproveEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllAccountingTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedEmployee, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedCandidate, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedOrganization, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeRolesAndPermissions, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSuperAdminUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationPublicPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventoryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProductAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.TenantAddUserToOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewIntegrations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewFileStorage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPaymentGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSMSGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewCustomSMTP, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewImportExport, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobMatching, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGalleryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharingAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategoriesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.MigrateIntoGauzyCloud, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAccount, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAllData, notChecked);
});

// Employee roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Employee role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.employee
	);
});

And('User can verify Employee general roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAdminDashboard, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeletePayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmployeeExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteEmployeeExpenses, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalsRegister, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalsPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalTemplatesPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalTemplates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateResendDeleteInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOff, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicy, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequest, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequest, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessPrivateProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeInTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInvoices, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInvoicesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEstimates, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditEstimatesAdd, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllCandidatesDocuments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTask, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterview, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterviewers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteCandidateFeedback, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventory, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProduct, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteTags, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmails, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmailsTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationHelpCenter, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ApproveTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewContacts, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTeams, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContracts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEventTypes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessTimeTracker, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGallery, checked);
});

And('User can verify Employee administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInventoryGallery, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipment, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharing, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestMakeEquipmentMake, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestApproveEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypes, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategories, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllAccountingTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedEmployee, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedCandidate, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeRolesAndPermissions, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSuperAdminUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationPublicPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventoryAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProductAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicyAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicyAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequestAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequestAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.TenantAddUserToOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewIntegrations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewFileStorage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPaymentGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSMSGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewCustomSMTP, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewImportExport, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobMatching, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGalleryAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharingAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypesAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategoriesAdmin, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.MigrateIntoGauzyCloud, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAccount, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAllData, notChecked);
});

// Candidate roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Candidate role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.candidate
	);
});

And('User can verify Candidate general roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAdminDashboard, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeletePayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalsRegister, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalsPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalTemplatesPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPage, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateResendDeleteInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOff, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessPrivateProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeInTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInvoices, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInvoicesAdd, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEstimates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditEstimatesAdd, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllCandidatesDocuments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTask, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterview, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterviewers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteCandidateFeedback, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventory, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProduct, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteTags, checked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmails, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmailsTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationHelpCenter, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ApproveTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTeams, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContracts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEventTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessTimeTracker, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGallery, notChecked);
});

And('User can verify Candidate administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInventoryGallery, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestMakeEquipmentMake, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestApproveEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllAccountingTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedEmployee, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedCandidate, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeRolesAndPermissions, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSuperAdminUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationPublicPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventoryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProductAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.TenantAddUserToOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewIntegrations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewFileStorage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPaymentGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSMSGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewCustomSMTP, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewImportExport, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobMatching, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGalleryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharingAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategoriesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.MigrateIntoGauzyCloud, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAccount, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAllData, notChecked);
});

// Manager roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Manager role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.manager
	);
});

And('User can verify Manager general roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAdminDashboard, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeletePayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalsRegister, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalsPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalTemplatesPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateResendDeleteInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOff, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessPrivateProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeInTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInvoices, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInvoicesAdd, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEstimates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditEstimatesAdd, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllCandidatesDocuments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTask, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterview, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterviewers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteCandidateFeedback, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventory, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProduct, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteTags, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmails, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmailsTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationHelpCenter, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ApproveTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTeams, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContracts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEventTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessTimeTracker, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGallery, notChecked);
});

And('User can verify Manager administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInventoryGallery, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestMakeEquipmentMake, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestApproveEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllAccountingTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedEmployee, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedCandidate, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeRolesAndPermissions, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSuperAdminUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationPublicPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventoryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProductAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.TenantAddUserToOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewIntegrations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewFileStorage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPaymentGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSMSGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewCustomSMTP, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewImportExport, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobMatching, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGalleryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharingAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategoriesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.MigrateIntoGauzyCloud, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAccount, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAllData, notChecked);
});

// Viewer roles and permissions
And('User can see roles dropdown', () => {
	rolesPermissionsPage.rolesDropdownVisible();
});

When('User click on roles dropdown', () => {
	rolesPermissionsPage.clickRolesDropdown();
});

Then('User can see roles dropdown options', () => {
	rolesPermissionsPage.rolesDropdownOptionVisible();
});

And('User can select Viewer role from dropdown options', () => {
	rolesPermissionsPage.selectRoleFromDropdown(
		RolesPermissionsPageData.viewer
	);
});

And('User can verify Viewer general roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAdminDashboard, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeletePayments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteEmployeeExpenses, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllIncomes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalsRegister, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalsPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewProposalTemplatesPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteProposalTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateResendDeleteInvites, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOff, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicy, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequest, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessPrivateProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeInTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInvoices, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInvoicesAdd, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEstimates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditEstimatesAdd, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllCandidatesDocuments, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTask, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterview, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditInterviewers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteCandidateFeedback, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventory, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProduct, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteTags, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmails, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllEmailsTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationHelpCenter, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSalesPipelines, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ApproveTimesheet, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSprints, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditProjects, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewContacts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditTeams, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditContracts, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewEventTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessTimeTracker, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGallery, notChecked);
});

And('User can verify Viewer administration roles and permissions', () => {
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditInventoryGallery, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationEquipmentSharing, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestMakeEquipmentMake, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.RequestApproveEquipment, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypes, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationProductCategories, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllAccountingTemplates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationCandidates, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteOrganizationUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.CreateEditDeleteAllOrganizations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedEmployee, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedCandidate, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeSelectedOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ChangeRolesAndPermissions, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditSuperAdminUsers, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditOrganizationPublicPage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationInventoryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ManagementProductAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalsPolicyAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditTimeOffAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.EditApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewApprovalRequestAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.TenantAddUserToOrganization, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewIntegrations, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewFileStorage, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewPaymentGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewSMSGateway, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewCustomSMTP, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewImportExport, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobEmployees, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewJobMatching, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewInventoryGalleryAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationEquipmentSharingAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductTypesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.ViewOrganizationProductCategoriesAdmin, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.MigrateIntoGauzyCloud, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAccount, notChecked);
	rolesPermissionsPage.verifyState(RolesPermissionsPageData.AccessDeleteAllData, notChecked);
});
