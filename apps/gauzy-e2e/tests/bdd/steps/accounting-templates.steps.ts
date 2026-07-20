import { When } from '../../support/bdd';
import * as accountingTemplatesPage from '../../support/pages/AccountingTemplates.po';
import { AccountingTemplatesPageData } from '../../../src/support/Base/pagedata/AccountingTemplatesPageData';

// Converted 1:1 from the plain AccountingTemplatesTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

When('I visit the accounting templates page and pick a language', async () => {
	await accountingTemplatesPage.visitAccountingTemplatesPage();
	await accountingTemplatesPage.saveBtnVisible();
	await accountingTemplatesPage.languageSelectVisible();
	await accountingTemplatesPage.clickLanguageSelect();
	await accountingTemplatesPage.languageDropdownOptionVisible();
	await accountingTemplatesPage.selectLanguageFromDropdownOptions(
		AccountingTemplatesPageData.english
	);
});

When('I render and verify the invoice accounting template', async () => {
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

When('I render and verify the estimate accounting template', async () => {
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

When('I render and verify the receipt accounting template', async () => {
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
