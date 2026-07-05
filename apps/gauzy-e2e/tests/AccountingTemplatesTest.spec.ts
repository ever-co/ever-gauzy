import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as accountingTemplatesPage from './support/pages/AccountingTemplates.po';
import * as dashboardPage from './support/pages/Dashboard.po';
import { AccountingTemplatesPageData } from '../src/support/Base/pagedata/AccountingTemplatesPageData';
import { CustomCommands } from './support/commands';

test.describe('Accounting templates test', () => {
	test('Accounting templates test', async () => {
		// Scenario: Login with email
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		// Scenario: Visit Accounting templates page
		await test.step('Should visit the Accounting Templates page and pick a language', async () => {
			await accountingTemplatesPage.visitAccountingTemplatesPage();
			await accountingTemplatesPage.saveBtnVisible();
			await accountingTemplatesPage.languageSelectVisible();
			await accountingTemplatesPage.clickLanguageSelect();
			await accountingTemplatesPage.languageDropdownOptionVisible();
			await accountingTemplatesPage.selectLanguageFromDropdownOptions(
				AccountingTemplatesPageData.english
			);
		});

		// Scenario: Invoice template
		await test.step('Should render and verify the Invoice template', async () => {
			await accountingTemplatesPage.templateSelectVisible();
			await accountingTemplatesPage.clickTemplateSelect();
			await accountingTemplatesPage.templateDropdownOptionVisible();
			await accountingTemplatesPage.selectTemplateFromDropdownOptions(
				AccountingTemplatesPageData.invoiceOpt
			);
			await accountingTemplatesPage.verifyMainLogo();
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.invoice);
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.from);
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.to);
			await accountingTemplatesPage.verifyRightTableData(
				AccountingTemplatesPageData.invoiceNumber
			);
			await accountingTemplatesPage.verifyRightTableData(
				AccountingTemplatesPageData.invoiceDate
			);
			await accountingTemplatesPage.verifyRightTableData(AccountingTemplatesPageData.dueDate);
		});

		// Scenario: Estimate template
		await test.step('Should render and verify the Estimate template', async () => {
			await accountingTemplatesPage.templateSelectVisible();
			await accountingTemplatesPage.clickTemplateSelect();
			await accountingTemplatesPage.templateDropdownOptionVisible();
			await accountingTemplatesPage.selectTemplateFromDropdownOptions(
				AccountingTemplatesPageData.estimateOpt
			);
			await accountingTemplatesPage.verifyMainLogo();
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.estimate);
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.from);
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.to);
			await accountingTemplatesPage.verifyRightTableData(
				AccountingTemplatesPageData.estimateNumber
			);
			await accountingTemplatesPage.verifyRightTableData(
				AccountingTemplatesPageData.estimateDate
			);
			await accountingTemplatesPage.verifyRightTableData(AccountingTemplatesPageData.dueDate);
		});

		// Scenario: Receipt template
		await test.step('Should render and verify the Receipt template', async () => {
			await accountingTemplatesPage.templateSelectVisible();
			await accountingTemplatesPage.clickTemplateSelect();
			await accountingTemplatesPage.templateDropdownOptionVisible();
			await accountingTemplatesPage.selectTemplateFromDropdownOptions(
				AccountingTemplatesPageData.receiptOpt
			);
			await accountingTemplatesPage.verifyMainLogo();
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.receipt);
			await accountingTemplatesPage.verifyLeftTableData(AccountingTemplatesPageData.billTo);
			await accountingTemplatesPage.verifyReceiptNumberAndPaymentData(
				AccountingTemplatesPageData.receiptNumber
			);
			await accountingTemplatesPage.verifyRightTableData(
				AccountingTemplatesPageData.paymentDate
			);
			await accountingTemplatesPage.verifyReceiptNumberAndPaymentData(
				AccountingTemplatesPageData.paymentMethod
			);
		});
	});
});
