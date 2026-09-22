import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	compareTwoTexts,
	clickButtonByIndex
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
// NOTE: the on-disk file is misspelled "Tempates" (no 'l'); the symbol it exports is EmailTemplatesPage.
import { EmailTemplatesPage } from '../../../src/support/Base/pageobjects/EmailTempatesPageObject';

export const selectLanguageButtonVisible = async () => {
	await verifyElementIsVisible(EmailTemplatesPage.selectLanguageButtonCss);
};

export const clickSelectLanguageButton = async () => {
	await clickButton(EmailTemplatesPage.selectLanguageButtonCss);
};

export const selectLanguageOption = async (data: string) => {
	await clickElementByText(EmailTemplatesPage.selectLanguageOptionCss, data);
};

export const emailTemplateSubjectVisible = async () => {
	await verifyElementIsVisible(EmailTemplatesPage.templatePageSubjectCss);
};

export const validateEmailTemplateSubject = async (text: string) => {
	await compareTwoTexts(EmailTemplatesPage.templatePageSubjectCss, text);
};

export const emailTemplateButtonVisible = async () => {
	await verifyElementIsVisible(EmailTemplatesPage.templateButtonCss);
};

export const clickEmailTemplateButton = async () => {
	await clickButtonByIndex(EmailTemplatesPage.templateButtonCss, 0);
};

export const selectTemplateButtonVisible = async () => {
	await verifyElementIsVisible(EmailTemplatesPage.selectTemplateButtonCss);
};

export const clickSelectTemplateButton = async () => {
	await clickButton(EmailTemplatesPage.selectTemplateButtonCss);
};

export const selectTemplateOption = async (data: string) => {
	await clickElementByText(EmailTemplatesPage.selectTemplateOptionCss, data);
};
