import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as emailHistoryPage from '../../Base/pages/EmailHistory.po';
import { EmailHistoryPageData } from '../../Base/pagedata/EmailHistoryPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials and visit Email history page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/settings/email-history', { timeout: pageLoadTimeout });
});

// Verify email templates dropdown
Then('User can verify Email history page', () => {
	emailHistoryPage.verifyHeaderText(EmailHistoryPageData.header);
});

And('User can see filter button', () => {
	emailHistoryPage.filterButtonVisible();
});

When('User click on filter button', () => {
	emailHistoryPage.clickFilterButton();
});

Then('User can see email templates dropdown', () => {
	emailHistoryPage.templatesDropdownVisible();
});

When('User click on email templates dropdown', () => {
	emailHistoryPage.clickTemplatesDropdown();
	emailHistoryPage.clickTemplatesDropdownDouble();
});

And('User can verify  Appointment Cancellation templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentCancellationBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentCancellationEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentCancellationHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentCancellationRussian
	);
});

And('User can verify Appointment Confirmation templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentConfirmationBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentConfirmationEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentConfirmationHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.appointmentConfirmationRussian
	);
});

And('User can verify Candidate Schedule Interview templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.candidateScheduleInterviewBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.candidateScheduleInterviewEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.candidateScheduleInterviewHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.candidateScheduleInterviewRussian
	);
});

And('User can verify Email Appointment templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailAppointmentBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailAppointmentEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailAppointmentHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailAppointmentRussian
	);
});

And('User can verify Email Estimate templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailEstimateBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailEstimateEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailEstimateHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailEstimateRussian
	);
});

And('User can verify Email Invoice templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailInvoiceBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailInvoiceEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailInvoiceHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.emailInvoiceRussian
	);
});

And('User can verify Equipment templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.equipmentBulgarian
	);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.equipmentEnglish);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.equipmentHebrew);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.equipmentRussian);
});

And('User can verify Equipment Request templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.equipmentRequestBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.equipmentRequestEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.equipmentRequestHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.equipmentRequestRussian
	);
});

And('User can verify Interviewer Interview Schedule templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.interviewerInterviewScheduleBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.interviewerInterviewScheduleEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.interviewerInterviewScheduleHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.interviewerInterviewScheduleRussian
	);
});

And('User can verify Invite Employee templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteEmployeeBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteEmployeeEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteEmployeeHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteEmployeeRussian
	);
});

And('User can verify Invite Organization Client templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteOrganizationClientBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteOrganizationClientEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteOrganizationClientHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteOrganizationClientRussian
	);
});

And('User can verify Invite User templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.inviteUserBulgarian
	);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.inviteUserEnglish);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.inviteUserHebrew);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.inviteUserRussian);
});

And('User can verify Password templates', () => {
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.passwordBulgarian);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.passwordEnglish);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.passwordHebrew);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.passwordRussian);
});

And('User can verify Payment Receipt templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.paymentReceiptBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.paymentReceiptEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.paymentReceiptHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.paymentReceiptRussian
	);
});

And('User can verify Task Update templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.taskUpdateBulgarian
	);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.taskUpdateEnglish);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.taskUpdateHebrew);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.taskUpdateRussian);
});

And('User can verify Time Off Report Action templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timeOffReportActionBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timeOffReportActionEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timeOffReportActionHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timeOffReportActionRussian
	);
});

And('User can verify Timesheet Action templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetActionBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetActionEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetActionHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetActionRussian
	);
});

And('User can verify Timesheet Delete templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetDeleteBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetDeleteEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetDeleteHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetDeleteRussian
	);
});

And('User can verify Timesheet Overview templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetOverviewBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetOverviewEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetOverviewHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetOverviewRussian
	);
});

And('User can verify Timesheet Submit templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetSubmitBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetSubmitEnglish
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetSubmitHebrew
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.timesheetSubmitRussian
	);
});

And('User can verify Welcome User templates', () => {
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.welcomeUserBulgarian
	);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.welcomeUserEnglish
	);
	emailHistoryPage.verifyDropdownText(EmailHistoryPageData.welcomeUserHebrew);
	emailHistoryPage.verifyDropdownText(
		EmailHistoryPageData.welcomeUserRussian
	);
	emailHistoryPage.clickKeyboardButtonByKeyCode(9);
});

// Select template from dropdown
And('User can select template option from dropdown', () => {
	emailHistoryPage.clickKeyboardButtonByKeyCode(9);
	emailHistoryPage.clickTemplatesDropdown();
	emailHistoryPage.selectOptionFromDropdown(
		EmailHistoryPageData.appointmentCancellationBulgarian
	);
});

Then('User can see save button', () => {
	emailHistoryPage.saveButtonVisible();
});

When('User click on save button', () => {
	emailHistoryPage.clickSaveButton();
});

Then('User can verify badge', () => {
	emailHistoryPage.verifyBadgeExist();
});
