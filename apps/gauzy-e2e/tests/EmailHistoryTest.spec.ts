import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as emailHistoryPage from './support/pages/EmailHistory.po';
import { EmailHistoryPageData } from '../src/support/Base/pagedata/EmailHistoryPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Email history Test', () => {
	test('Email history Test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to verify Appointment Cancellation', async () => {
			await getPage().goto('/#/pages/settings/email-history');
			await emailHistoryPage.verifyHeaderText(EmailHistoryPageData.header);
			await emailHistoryPage.filterButtonVisible();
			await emailHistoryPage.clickFilterButton();
			await emailHistoryPage.templatesDropdownVisible();
			await emailHistoryPage.clickTemplatesDropdown();
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentCancellationBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentCancellationEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentCancellationHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentCancellationRussian
			);
		});

		await test.step('Should be able to verify Appointment Confirmation', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentConfirmationBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentConfirmationEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentConfirmationHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.appointmentConfirmationRussian
			);
		});

		await test.step('Should be able to verify Candidate Schedule Interview', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.candidateScheduleInterviewBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.candidateScheduleInterviewEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.candidateScheduleInterviewHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.candidateScheduleInterviewRussian
			);
		});

		await test.step('Should be able to verify Email Appointment', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailAppointmentBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailAppointmentEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailAppointmentHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailAppointmentRussian
			);
		});

		await test.step('Should be able to verify Email Estimate', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailEstimateBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailEstimateEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailEstimateHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailEstimateRussian
			);
		});

		await test.step('Should be able to verify Email Invoice', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailInvoiceBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailInvoiceEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailInvoiceHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.emailInvoiceRussian
			);
		});

		await test.step('Should be able to verify Equipment', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentRussian
			);
		});

		await test.step('Should be able to verify Equipment Request', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentRequestBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentRequestEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentRequestHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.equipmentRequestRussian
			);
		});

		await test.step('Should be able to verify Interviewer Interview Schedule', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.interviewerInterviewScheduleBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.interviewerInterviewScheduleEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.interviewerInterviewScheduleHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.interviewerInterviewScheduleRussian
			);
		});

		await test.step('Should be able to verify Invite Employee', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteEmployeeBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteEmployeeEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteEmployeeHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteEmployeeRussian
			);
		});

		await test.step('Should be able to verify Invite Organization Client', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteOrganizationClientBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteOrganizationClientEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteOrganizationClientHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteOrganizationClientRussian
			);
		});

		await test.step('Should be able to verify Invite User', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteUserBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteUserEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteUserHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.inviteUserRussian
			);
		});

		await test.step('Should be able to verify Password', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.passwordBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.passwordEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.passwordHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.passwordRussian
			);
		});

		await test.step('Should be able to verify Payment Receipt', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.paymentReceiptBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.paymentReceiptEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.paymentReceiptHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.paymentReceiptRussian
			);
		});

		await test.step('Should be able to verify Task Update', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.taskUpdateBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.taskUpdateEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.taskUpdateHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.taskUpdateRussian
			);
		});

		await test.step('Should be able to verify Time Off Report Action', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timeOffReportActionBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timeOffReportActionEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timeOffReportActionHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timeOffReportActionRussian
			);
		});

		await test.step('Should be able to verify Timesheet Action', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetActionBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetActionEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetActionHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetActionRussian
			);
		});

		await test.step('Should be able to verify Timesheet Delete', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetDeleteBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetDeleteEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetDeleteHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetDeleteRussian
			);
		});

		await test.step('Should be able to verify Timesheet Overview', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetOverviewBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetOverviewEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetOverviewHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetOverviewRussian
			);
		});

		await test.step('Should be able to verify Timesheet Submit', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetSubmitBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetSubmitEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetSubmitHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.timesheetSubmitRussian
			);
		});

		await test.step('Should be able to verify Welcome User', async () => {
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.welcomeUserBulgarian
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.welcomeUserEnglish
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.welcomeUserHebrew
			);
			await emailHistoryPage.verifyDropdownText(
				EmailHistoryPageData.welcomeUserRussian
			);
		});

		await test.step('Should be able to verify badge', async () => {
			await emailHistoryPage.clickKeyboardButtonByKeyCode(9);
			await emailHistoryPage.clickTemplatesDropdown();
			await emailHistoryPage.selectOptionFromDropdown(
				EmailHistoryPageData.appointmentCancellationBulgarian
			);
			await emailHistoryPage.saveButtonVisible();
			await emailHistoryPage.clickSaveButton();
			await emailHistoryPage.verifyBadgeExist();
		});
	});
});
