import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as emailHistoryPage from '../support/Base/pages/EmailHistory.po';
import { EmailHistoryPageData } from '../support/Base/pagedata/EmailHistoryPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

describe('Email history Test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	});

	it('Should be able to verify Appointment Cancellation', () => {
		cy.visit('/#/pages/settings/email-history');
		emailHistoryPage.verifyHeaderText(EmailHistoryPageData.header);
		emailHistoryPage.filterButtonVisible();
		emailHistoryPage.clickFilterButton();
		emailHistoryPage.templatesDropdownVisible();
		emailHistoryPage.clickTemplatesDropdown();
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
	it('Should be able to verify Appointment Confirmation', () => {
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
	it('Should be able to verify Candidate Schedule Interview', () => {
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
	it('Should be able to verify Email Appointment', () => {
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
	it('Should be able to verify Email Estimate', () => {
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
	it('Should be able to verify Email Invoice', () => {
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
	it('Should be able to verify Equipment', () => {
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.equipmentBulgarian
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.equipmentEnglish
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.equipmentHebrew
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.equipmentRussian
		);
	});
	it('Should be able to verify Equipment Request', () => {
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
	it('Should be able to verify Interviewer Interview Schedule', () => {
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
	it('Should be able to verify Invite Employee', () => {
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
	it('Should be able to verify Invite Organization Client', () => {
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
	it('Should be able to verify Invite User', () => {
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.inviteUserBulgarian
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.inviteUserEnglish
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.inviteUserHebrew
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.inviteUserRussian
		);
	});
	it('Should be able to verify Password', () => {
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.passwordBulgarian
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.passwordEnglish
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.passwordHebrew
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.passwordRussian
		);
	});
	it('Should be able to verify Payment Receipt', () => {
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
	it('Should be able to verify Task Update', () => {
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.taskUpdateBulgarian
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.taskUpdateEnglish
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.taskUpdateHebrew
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.taskUpdateRussian
		);
	});
	it('Should be able to verify Time Off Report Action', () => {
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
	it('Should be able to verify Timesheet Action', () => {
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
	it('Should be able to verify Timesheet Delete', () => {
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
	it('Should be able to verify Timesheet Overview', () => {
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
	it('Should be able to verify Timesheet Submit', () => {
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
	it('Should be able to verify Welcome User', () => {
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.welcomeUserBulgarian
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.welcomeUserEnglish
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.welcomeUserHebrew
		);
		emailHistoryPage.verifyDropdownText(
			EmailHistoryPageData.welcomeUserRussian
		);
	});
	it('Should be able to verify badge', () => {
		emailHistoryPage.clickKeyboardButtonByKeyCode(9);
		emailHistoryPage.clickTemplatesDropdown();
		emailHistoryPage.selectOptionFromDropdown(
			EmailHistoryPageData.appointmentCancellationBulgarian
		);
		emailHistoryPage.saveButtonVisible();
		emailHistoryPage.clickSaveButton();
		emailHistoryPage.verifyBadgeExist();
	});
});
