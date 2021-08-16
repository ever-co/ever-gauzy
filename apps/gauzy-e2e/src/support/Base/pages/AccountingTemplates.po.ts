import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText,
	waitUntil
} from '../utils/util';
import { AccountingTemplatesPage } from '../pageobjects/AccountingTemplatesPageObject';

export const languageSelectVisible = () => {
	verifyElementIsVisible(AccountingTemplatesPage.languageSelectCss);
};

export const clickLanguageSelect = () => {
	clickButton(AccountingTemplatesPage.languageSelectCss);
};

export const languageDropdownOptionVisible = () => {
	verifyElementIsVisible(AccountingTemplatesPage.languageDropdownOptionCss);
};

export const selectLanguageFromDropdownOptions = (language) => {
	clickElementByText(
		AccountingTemplatesPage.languageDropdownOptionCss,
		language
	);
};

export const templateSelectVisible = () => {
	verifyElementIsVisible(AccountingTemplatesPage.templateSelectCss);
};

export const clickTemplateSelect = () => {
	clickButton(AccountingTemplatesPage.templateSelectCss);
};

export const templateDropdownOptionVisible = () => {
	verifyElementIsVisible(AccountingTemplatesPage.templateDropdownOptionCss);
};

export const selectTemplateFromDropdownOptions = (template) => {
	clickElementByText(
		AccountingTemplatesPage.templateDropdownOptionCss,
		template
	);
};

export const verifyLeftTableData = (text) => {
	verifyText(AccountingTemplatesPage.leftTableDataCss, text);
};

export const verifyRightTableData = (text) => {
	verifyText(AccountingTemplatesPage.rightTableDataCss, text);
};

export const verifyMainLogo = () => {
	waitUntil(5000);
	verifyElementIsVisible(AccountingTemplatesPage.logoCss);
};

export const saveBtnVisible = () => {
	verifyElementIsVisible(AccountingTemplatesPage.saveBtnCss);
};

export const verifyReceiptNumberAndPaymentData = (text) => {
	verifyText(
		AccountingTemplatesPage.receiptNumberAndPaymentMethodDataCss,
		text
	);
};
