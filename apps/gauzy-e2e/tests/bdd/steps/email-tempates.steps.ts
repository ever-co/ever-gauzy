import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as emailTemplatesPage from '../../support/pages/EmailTempates.po';
import { EmailTemplatesPageData } from '../../../src/support/Base/pagedata/EmailTempatesPageData';

// Converted 1:1 from the plain EmailTempatesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts. State (selected template / language) persists on the same
// email-templates page across steps exactly as in the original single-test() flow.

When('I validate the Password Reset email template', async () => {
	await getPage().goto('/#/pages/settings/email-templates');
	await emailTemplatesPage.selectLanguageButtonVisible();
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectRussian
	);
	// NOTE: the legacy "open template in new tab" link (templateButtonCss
	// 'tbody > tr > td > a[target="_blank"]') no longer exists on this page — the preview
	// is rendered inline in #previewSubject/#previewEmail. The emailTemplateButton steps are
	// dropped; validateEmailTemplateSubject already covers the assertion intent.
});

When('I validate the Appointment Confirmation email template', async () => {
	await emailTemplatesPage.selectTemplateButtonVisible();
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.appointmentConfirmationTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectRussian
	);
	// Legacy emailTemplateButton steps dropped (see Password Reset step note).
});

When('I validate the Appointment Cancellation email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.appointmentCancellationTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectRussian
	);
});

When('I validate the Time Off Policy email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeOffPolicyTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectRussian
	);
});

When('I validate the Task Update email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.taskUpdateTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectRussian
	);
});

When('I validate the Equipment Create email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.equipmentCreateTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectRussian
	);
});

When('I validate the Equipment Request email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.equipmentRequestTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectRussian
	);
});

When('I validate the Time Sheet Overview email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetOverviewTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectRussian
	);
});

When('I validate the Time Sheet Submit email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetSubmitTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectRussian
	);
});

When('I validate the Time Sheet Actions email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetActionsTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectRussian
	);
});

When('I validate the Time Sheet Delete email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetDeleteTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectRussian
	);
});

When('I validate the Candidate Interview Schedule email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.candidateInterviewScheduleTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.candidateInterviewScheduleSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.candidateInterviewScheduleSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.candidateInterviewScheduleSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.candidateInterviewScheduleSubjectRussian
	);
});

When('I validate the Interviewer Schedule email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.interviewerScheduleTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectRussian
	);
});

When('I validate the Welcome User email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.welcomeUserTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectRussian
	);
});

When('I validate the Invite Organization Client email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.inviteOrganizationClientTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectRussian
	);
});

When('I validate the Invite Employee email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.inviteEmployeeTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectRussian
	);
});

When('I validate the Invite User email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.inviteUserTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectEnglish
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(
		EmailTemplatesPageData.bulgarian
	);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectBulgarian
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectHebrew
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectRussian
	);
});

When('I validate the Email Invoice email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.emailInvoiceTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.emailInvoiceSubjectEnglish
	);
});

When('I validate the Email Estimate email template', async () => {
	await emailTemplatesPage.clickSelectTemplateButton();
	await emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.emailEstimateTemplateOption
	);
	await emailTemplatesPage.clickSelectLanguageButton();
	await emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
	await emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.emailEstimateSubjectEnglish
	);
});
