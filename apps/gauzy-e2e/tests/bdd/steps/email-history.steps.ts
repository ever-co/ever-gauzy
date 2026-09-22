import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as emailHistoryPage from '../../support/pages/EmailHistory.po';
import { EmailHistoryPageData } from '../../../src/support/Base/pagedata/EmailHistoryPageData';

// Converted 1:1 from the plain EmailHistoryTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The first step keeps the getPage().goto navigation and the
// filter/templates-dropdown open sequence that every following step depends on. The `Given I am logged
// in as the default user` Background step is defined once in common.steps.ts.

When('I verify the Appointment Cancellation email templates', async () => {
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

When('I verify the Appointment Confirmation email templates', async () => {
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

When('I verify the Candidate Schedule Interview email templates', async () => {
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

When('I verify the Email Appointment email templates', async () => {
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

When('I verify the Email Estimate email templates', async () => {
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

When('I verify the Email Invoice email templates', async () => {
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

When('I verify the Equipment email templates', async () => {
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

When('I verify the Equipment Request email templates', async () => {
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

When('I verify the Interviewer Interview Schedule email templates', async () => {
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

When('I verify the Invite Employee email templates', async () => {
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

When('I verify the Invite Organization Client email templates', async () => {
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

When('I verify the Invite User email templates', async () => {
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

When('I verify the Password email templates', async () => {
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

When('I verify the Payment Receipt email templates', async () => {
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

When('I verify the Task Update email templates', async () => {
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

When('I verify the Time Off Report Action email templates', async () => {
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

When('I verify the Timesheet Action email templates', async () => {
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

When('I verify the Timesheet Delete email templates', async () => {
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

When('I verify the Timesheet Overview email templates', async () => {
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

When('I verify the Timesheet Submit email templates', async () => {
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

When('I verify the Welcome User email templates', async () => {
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

When('I verify the email history badge', async () => {
	await emailHistoryPage.clickKeyboardButtonByKeyCode(9);
	await emailHistoryPage.clickTemplatesDropdown();
	await emailHistoryPage.selectOptionFromDropdown(
		EmailHistoryPageData.appointmentCancellationBulgarian
	);
	await emailHistoryPage.saveButtonVisible();
	await emailHistoryPage.clickSaveButton();
	await emailHistoryPage.verifyBadgeExist();
});
