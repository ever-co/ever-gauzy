import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText,
	waitUntil
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AccountingTemplatesPage } from '../../../src/support/Base/pageobjects/AccountingTemplatesPageObject';

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.languageSelectCss);
};

export const clickLanguageSelect = async () => {
	await clickButton(AccountingTemplatesPage.languageSelectCss);
};

export const languageDropdownOptionVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.languageDropdownOptionCss);
};

export const selectLanguageFromDropdownOptions = async (language: string) => {
	await clickElementByText(
		AccountingTemplatesPage.languageDropdownOptionCss,
		language
	);
};

export const templateSelectVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.templateSelectCss);
};

export const clickTemplateSelect = async () => {
	await clickButton(AccountingTemplatesPage.templateSelectCss);
};

export const templateDropdownOptionVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.templateDropdownOptionCss);
};

export const selectTemplateFromDropdownOptions = async (template: string) => {
	await clickElementByText(
		AccountingTemplatesPage.templateDropdownOptionCss,
		template
	);
};

export const verifyLeftTableData = async (text: string) => {
	await verifyText(AccountingTemplatesPage.leftTableDataCss, text);
};

export const verifyRightTableData = async (text: string) => {
	await verifyText(AccountingTemplatesPage.rightTableDataCss, text);
};

export const verifyMainLogo = async () => {
	await waitUntil(5000);
	await verifyElementIsVisible(AccountingTemplatesPage.logoCss);
};

export const saveBtnVisible = async () => {
	await verifyElementIsVisible(AccountingTemplatesPage.saveBtnCss);
};

export const verifyReceiptNumberAndPaymentData = async (text: string) => {
	await verifyText(
		AccountingTemplatesPage.receiptNumberAndPaymentMethodDataCss,
		text
	);
};
