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
	// The filters dialog became an inline filter bar (#10457): open its Template filter directly.
	await emailHistoryPage.templateFilterVisible();
	await emailHistoryPage.openTemplateFilter();
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentCancellationBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentCancellationEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentCancellationHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentCancellationRussian
	);
});

When('I verify the Appointment Confirmation email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentConfirmationBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentConfirmationEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentConfirmationHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.appointmentConfirmationRussian
	);
});

When('I verify the Candidate Schedule Interview email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.candidateScheduleInterviewBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.candidateScheduleInterviewEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.candidateScheduleInterviewHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.candidateScheduleInterviewRussian
	);
});

When('I verify the Email Appointment email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailAppointmentBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailAppointmentEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailAppointmentHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailAppointmentRussian
	);
});

When('I verify the Email Estimate email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailEstimateBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailEstimateEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailEstimateHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailEstimateRussian
	);
});

When('I verify the Email Invoice email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailInvoiceBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailInvoiceEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailInvoiceHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.emailInvoiceRussian
	);
});

When('I verify the Equipment email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentRussian
	);
});

When('I verify the Equipment Request email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentRequestBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentRequestEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentRequestHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.equipmentRequestRussian
	);
});

When('I verify the Interviewer Interview Schedule email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.interviewerInterviewScheduleBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.interviewerInterviewScheduleEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.interviewerInterviewScheduleHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.interviewerInterviewScheduleRussian
	);
});

When('I verify the Invite Employee email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteEmployeeBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteEmployeeEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteEmployeeHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteEmployeeRussian
	);
});

When('I verify the Invite Organization Client email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteOrganizationClientBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteOrganizationClientEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteOrganizationClientHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteOrganizationClientRussian
	);
});

When('I verify the Invite User email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteUserBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteUserEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteUserHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.inviteUserRussian
	);
});

When('I verify the Password email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.passwordBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.passwordEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.passwordHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.passwordRussian
	);
});

When('I verify the Payment Receipt email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.paymentReceiptBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.paymentReceiptEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.paymentReceiptHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.paymentReceiptRussian
	);
});

When('I verify the Task Update email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.taskUpdateBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.taskUpdateEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.taskUpdateHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.taskUpdateRussian
	);
});

When('I verify the Time Off Report Action email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timeOffReportActionBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timeOffReportActionEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timeOffReportActionHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timeOffReportActionRussian
	);
});

When('I verify the Timesheet Action email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetActionBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetActionEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetActionHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetActionRussian
	);
});

When('I verify the Timesheet Delete email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetDeleteBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetDeleteEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetDeleteHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetDeleteRussian
	);
});

When('I verify the Timesheet Overview email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetOverviewBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetOverviewEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetOverviewHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetOverviewRussian
	);
});

When('I verify the Timesheet Submit email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetSubmitBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetSubmitEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetSubmitHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.timesheetSubmitRussian
	);
});

When('I verify the Welcome User email templates', async () => {
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.welcomeUserBulgarian
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.welcomeUserEnglish
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.welcomeUserHebrew
	);
	await emailHistoryPage.verifyTemplateOption(
		EmailHistoryPageData.welcomeUserRussian
	);
});

When('I verify the email history badge', async () => {
	// Choosing a template applies the filter at once and shows it as a chip (the dialog's Save + badge).
	await emailHistoryPage.clickKeyboardButtonByKeyCode(9);
	await emailHistoryPage.openTemplateFilter();
	await emailHistoryPage.selectTemplateOption(EmailHistoryPageData.appointmentCancellationBulgarian);
	await emailHistoryPage.verifyActiveFilterChip(EmailHistoryPageData.appointmentCancellationBulgarianChip);
});
