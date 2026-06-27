import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as emailTemplatesPage from './support/pages/EmailTempates.po';
import { EmailTemplatesPageData } from '../src/support/Base/pagedata/EmailTempatesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

test.describe('Validate email templates test', () => {
	test('Validate email templates test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to validate Password Reset template', async () => {
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

		await test.step('Should be able to validate Appointment Confirmation template', async () => {
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

		await test.step('Should be able to validate Appointment Cancellation template', async () => {
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

		await test.step('Should be able to validate Time Off Policy template', async () => {
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

		await test.step('Should be able to validate Task Update template', async () => {
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

		await test.step('Should be able to validate Equipment Create template', async () => {
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

		await test.step('Should be able to validate Equipment Request template', async () => {
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

		await test.step('Should be able to validate Time Sheet Overview template', async () => {
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

		await test.step('Should be able to validate Time Sheet Submit template', async () => {
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

		await test.step('Should be able to validate Time Sheet Actions template', async () => {
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

		await test.step('Should be able to validate Time Sheet Delete template', async () => {
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

		await test.step('Should be able to validate Candidate Interview Schedule template', async () => {
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

		await test.step('Should be able to validate Interviewer Schedule template', async () => {
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

		await test.step('Should be able to validate Welcome User template', async () => {
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

		await test.step('Should be able to validate Invite Organization Client template', async () => {
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

		await test.step('Should be able to validate Invite Employee template', async () => {
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

		await test.step('Should be able to validate Invite User template', async () => {
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

		await test.step('Should be able to validate Email Invoice', async () => {
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

		await test.step('Should be able to validate Email Estimate', async () => {
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
	});
});
