import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	compareTwoTexts,
	clickButtonByIndex
} from '../utils/util';
import { EmailTemplatesPage } from '../pageobjects/EmailTempatesPageObject';

export const selectLanguageButtonVisible = () => {
	verifyElementIsVisible(EmailTemplatesPage.selectLanguageButtonCss);
};

export const clickSelectLanguageButton = () => {
	clickButton(EmailTemplatesPage.selectLanguageButtonCss);
};

export const selectLanguageOption = (data) => {
	clickElementByText(EmailTemplatesPage.selectLanguageOptionCss, data);
};

export const emailtTemplateSubjectVisible = () => {
	verifyElementIsVisible(EmailTemplatesPage.templatePageSubjectCss);
};

export const validateEmailTemplateSubject = (text) => {
	compareTwoTexts(EmailTemplatesPage.templatePageSubjectCss, text);
};

export const emailTemplateButtonVisible = () => {
	verifyElementIsVisible(EmailTemplatesPage.templateButtonCss);
};

export const clickEmailTemplateButton = () => {
	clickButtonByIndex(EmailTemplatesPage.templateButtonCss, 0);
};

export const selectTemplateButtonVisible = () => {
	verifyElementIsVisible(EmailTemplatesPage.selectTemplateButtonCss);
};

export const clickSelectTemplateButton = () => {
	clickButton(EmailTemplatesPage.selectTemplateButtonCss);
};

export const selectTemplateOption = (data) => {
	clickElementByText(EmailTemplatesPage.selectTemplateOptionCss, data);
};
