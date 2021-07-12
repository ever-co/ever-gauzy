import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as emailTemplatesPage from '../../Base/pages/EmailTempates.po';
import { EmailTemplatesPageData } from '../../Base/pagedata/EmailTempatesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

// Login with email
Given('Login with default credentials and visit Email templates page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/settings/email-templates');
});

// Password Reset template
Then('User can see select language button', () => {
	emailTemplatesPage.selectLanguageButtonVisible();
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Password Reset template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Password Reset template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Password Reset template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Password Reset template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.passwordResetSubjectRussian
	);
});

// Appointment Confirmation template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Appointment Confirmation template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.appointmentConfirmationTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

Then('User can verify Appointment Confirmation template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Appointment Confirmation template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Appointment Confirmation template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Appointment Confirmation template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentConfirmationSubjectRussian
	);
});

// Appointment Cancellation template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Appointment Cancellation template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.appointmentCancellationTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Appointment Cancellation template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Appointment Cancellation template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Appointment Cancellation template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Appointment Cancellation template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.appointmentCancellationSubjectRussian
	);
});

// Time Off Policy template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Time Off Policy template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeOffPolicyTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Time Off Policy template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Time Off Policy template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Time Off Policy template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Time Off Policy template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeOffPolicySubjectRussian
	);
});

// Task Update template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Task Update template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.taskUpdateTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Task Update template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Task Update template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Task Update template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Task Update template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.taskUpdateSubjectRussian
	);
});

// Equipment Create template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Equipment Create template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.equipmentCreateTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Equipment Create template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Equipment Create template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Equipment Create template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Equipment Create template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentCreateSubjectRussian
	);
});

// Equipment Request template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Equipment Request template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.equipmentRequestTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Equipment Request template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Equipment Request template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Equipment Request template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Equipment Request template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectRussian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Equipment Request template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.equipmentRequestSubjectRussian
	);
});

// Time Sheet Overview template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Time Sheet Overview template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetOverviewTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Time Sheet Overview template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Time Sheet Overview template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Time Sheet Overview template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Time Sheet Overview template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetOverviewSubjectRussian
	);
});

// Time Sheet Submit template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Time Sheet Submit template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetSubmitTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Time Sheet Submit template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Time Sheet Submit template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Time Sheet Submit template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Time Sheet Submit template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetSubmitSubjectRussian
	);
});

// Time Sheet Actions template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Time Sheet Actions template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetActionsTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Time Sheet Actions template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Time Sheet Actions template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Time Sheet Actions template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Time Sheet Actions template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetActionsSubjectRussian
	);
});

// Time Sheet Delete template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Time Sheet Delete template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.timeSheetDeleteTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Time Sheet Delete template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Time Sheet Delete template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Time Sheet Delete template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Time Sheet Delete template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.timeSheetDeleteSubjectRussian
	);
});

// Candidate Interview Schedule template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Candidate Interview Schedule template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.candidateInterviewScheduleTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Candidate Interview Schedule template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.candidateInterviewScheduleSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And(
	'User can verify Candidate Interview Schedule template in Bulgarian',
	() => {
		emailTemplatesPage.validateEmailTemplateSubject(
			EmailTemplatesPageData.candidateInterviewScheduleSubjectBulgarian
		);
	}
);

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Candidate Interview Schedule template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.candidateInterviewScheduleSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Candidate Interview Schedule template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.candidateInterviewScheduleSubjectRussian
	);
});

// Interviewer Schedule template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Interviewer Schedule template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.interviewerScheduleTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Interviewer Schedule template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Interviewer Schedule template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Interviewer Schedule template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Interviewer Schedule template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.interviewerScheduleSubjectRussian
	);
});

// Welcome User template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Welcome User template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.welcomeUserTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Welcome User template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Welcome User template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Welcome User template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Welcome User template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.welcomeUserSubjectRussian
	);
});

// Invite Organization Client template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Invite Organization Client template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.inviteOrganizationClientTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Invite Organization Client template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Invite Organization Client template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Invite Organization Client template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Invite Organization Client template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteOrganizationClientSubjectRussian
	);
});

// Invite Employee template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Invite Employee template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.inviteEmployeeTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Invite Employee template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Invite Employee template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Invite Employee template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Invite Employee template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteEmployeeSubjectRussian
	);
});

// Invite User template
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Invite User template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.inviteUserTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Invite User template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectEnglish
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Bulgarian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.bulgarian);
});

And('User can verify Invite User template in Bulgarian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectBulgarian
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Hebrew language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.hebrew);
});

And('User can verify Invite User template in Hebrew', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectHebrew
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select Russian language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.russian);
});

And('User can verify Invite User template in Russian', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.inviteUserSubjectRussian
	);
});

// Email Invoice
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Email Invoice template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.emailInvoiceTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Email Invoice template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.emailInvoiceSubjectEnglish
	);
});

// Email Estimate
Then('User can see select template button', () => {
	emailTemplatesPage.selectTemplateButtonVisible();
});

When('User click on select template button', () => {
	emailTemplatesPage.clickSelectTemplateButton();
});

Then('User can select Email Estimate template option', () => {
	emailTemplatesPage.selectTemplateOption(
		EmailTemplatesPageData.emailEstimateTemplateOption
	);
});

When('User click on select language button', () => {
	emailTemplatesPage.clickSelectLanguageButton();
});

Then('User can select English language option from dropdown', () => {
	emailTemplatesPage.selectLanguageOption(EmailTemplatesPageData.english);
});

And('User can verify Email Estimate template in English', () => {
	emailTemplatesPage.validateEmailTemplateSubject(
		EmailTemplatesPageData.emailEstimateSubjectEnglish
	);
});
