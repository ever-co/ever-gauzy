import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as accountingTemplatesPage from '../../Base/pages/AccountingTemplates.po';
import { AccountingTemplatesPageData } from '../../Base/pagedata/AccountingTemplatesPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../../support/commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Visit Accounting templates page
And('User can visit Accounting templates page', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	cy.visit('/#/pages/settings/accounting-templates', { timeout: pageLoadTimeout });
});

And('User can see save button', () => {
	accountingTemplatesPage.saveBtnVisible();
});

And('User can see language select', () => {
	accountingTemplatesPage.languageSelectVisible();
});

When('User click on language select', () => {
	accountingTemplatesPage.clickLanguageSelect();
});

Then('user can see language dropdown options', () => {
	accountingTemplatesPage.languageDropdownOptionVisible();
});

And('User can select language from dropdown options', () => {
	accountingTemplatesPage.selectLanguageFromDropdownOptions(
		AccountingTemplatesPageData.english
	);
});

// Invoice template
And('User can see templates select', () => {
	accountingTemplatesPage.templateSelectVisible();
});

When('User click on templates select', () => {
	accountingTemplatesPage.clickTemplateSelect();
});

Then('User can see templates dropdown options', () => {
	accountingTemplatesPage.templateDropdownOptionVisible();
});

And('User can select Invoice dropdown option', () => {
	accountingTemplatesPage.selectTemplateFromDropdownOptions(
		AccountingTemplatesPageData.invoiceOpt
	);
});

And('User can verify main logo', () => {
	accountingTemplatesPage.verifyMainLogo();
});

And('User can verify invoice template header', () => {
	accountingTemplatesPage.verifyLeftTableData(
		AccountingTemplatesPageData.invoice
	);
});

And('User can verify sender column', () => {
	accountingTemplatesPage.verifyLeftTableData(
		AccountingTemplatesPageData.from
	);
});

And('User can verify receiver column', () => {
	accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.to);
});

And('User can verify invoice number column', () => {
	accountingTemplatesPage.verifyRightTableData(
		AccountingTemplatesPageData.invoiceNumber
	);
});

And('User can verify invoice date column', () => {
	accountingTemplatesPage.verifyRightTableData(
		AccountingTemplatesPageData.invoiceDate
	);
});

And('User can verify invoice due date column', () => {
	accountingTemplatesPage.verifyRightTableData(
		AccountingTemplatesPageData.dueDate
	);
});

// Estimate template
And('User can see templates select', () => {
	accountingTemplatesPage.templateSelectVisible();
});

When('User click on templates select', () => {
	accountingTemplatesPage.clickTemplateSelect();
});

Then('User can see templates dropdown options', () => {
	accountingTemplatesPage.templateDropdownOptionVisible();
});

And('User can select Estimate dropdown option', () => {
	accountingTemplatesPage.selectTemplateFromDropdownOptions(
		AccountingTemplatesPageData.estimateOpt
	);
});

And('User can verify main logo', () => {
	accountingTemplatesPage.verifyMainLogo();
});

And('User can verify estimate template header', () => {
	accountingTemplatesPage.verifyLeftTableData(
		AccountingTemplatesPageData.estimate
	);
});

And('User can verify sender column', () => {
	accountingTemplatesPage.verifyLeftTableData(
		AccountingTemplatesPageData.from
	);
});

And('User can verify receiver column', () => {
	accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.to);
});

And('User can verify estimate number column', () => {
	accountingTemplatesPage.verifyRightTableData(
		AccountingTemplatesPageData.estimateNumber
	);
});

And('User can verify estimate date column', () => {
	accountingTemplatesPage.verifyRightTableData(
		AccountingTemplatesPageData.estimateDate
	);
});

And('User can verify estimate due date column', () => {
	accountingTemplatesPage.verifyRightTableData(
		AccountingTemplatesPageData.dueDate
	);
});

// Receipt template
And('User can see templates select', () => {
	accountingTemplatesPage.templateSelectVisible();
});

When('User click on templates select', () => {
	accountingTemplatesPage.clickTemplateSelect();
});

Then('User can see templates dropdown options', () => {
	accountingTemplatesPage.templateDropdownOptionVisible();
});

And('User can select Receipt dropdown option', () => {
	accountingTemplatesPage.selectTemplateFromDropdownOptions(
		AccountingTemplatesPageData.receiptOpt
	);
});

And('User can verify main logo', () => {
	accountingTemplatesPage.verifyMainLogo();
});

And('User can verify receipt template header', () => {
	accountingTemplatesPage.verifyLeftTableData(
		AccountingTemplatesPageData.receipt
	);
});

And('User can verify bill to column', () => {
	accountingTemplatesPage.verifyLeftTableData(
		AccountingTemplatesPageData.billTo
	);
});

And('User can verify receipt number column', () => {
	accountingTemplatesPage.verifyReceiptNumberAndPaymentData(
		AccountingTemplatesPageData.receiptNumber
	);
});

And('User can verify receipt payment date column', () => {
	accountingTemplatesPage.verifyRightTableData(
		AccountingTemplatesPageData.paymentDate
	);
});

And('User can verify receipt payment method column', () => {
	accountingTemplatesPage.verifyReceiptNumberAndPaymentData(
		AccountingTemplatesPageData.paymentMethod
	);
});
