import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as paymentsPage from './support/pages/Payments.po';
import { PaymentsPageData } from '../src/support/Base/pagedata/PaymentsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from './support/commands';

test.describe('Payments test', () => {
	test('Payments test', async () => {
		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to add new payment', async () => {
			await CustomCommands.addProject(
				organizationProjectsPage,
				OrganizationProjectsPageData
			);
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await getPage().goto('/#/pages/accounting/payments');
			await paymentsPage.gridBtnExists();
			await paymentsPage.gridBtnClick(1);
			await paymentsPage.addPaymentButtonVisible();
			await paymentsPage.clickAddPaymentButton();
			await paymentsPage.tagsDropdownVisible();
			await paymentsPage.clickTagsDropdown(0);
			await paymentsPage.selectTagFromDropdown(0);
			await paymentsPage.clickCardBody();
			await paymentsPage.projectDropdownVisible();
			await paymentsPage.clickProjectDropdown();
			await paymentsPage.selectProjectFromDropdown(PaymentsPageData.defaultProject);
			await paymentsPage.dateInputVisible();
			await paymentsPage.enterDateInputData();
			await paymentsPage.paymentMethodDropdownVisible();
			await paymentsPage.clickPaymentMethodDropdown();
			await paymentsPage.selectPaymentMethod(PaymentsPageData.defaultPaymentMethod);
			await paymentsPage.amountInputVisible();
			await paymentsPage.enterAmountInputData(String(PaymentsPageData.defaultAmount));
			await paymentsPage.noteTextareaVisible();
			await paymentsPage.enterNoteInputData(PaymentsPageData.defaultNote);
			await paymentsPage.savePaymentButtonVisible();
			await paymentsPage.clickSavePaymentButton();
			await paymentsPage.waitMessageToHide();
			await paymentsPage.verifyPaymentExists(PaymentsPageData.defaultNote);
		});

		await test.step('Should be able to edit payment', async () => {
			await paymentsPage.tableRowVisible();
			await paymentsPage.selectTableRow(0);
			await paymentsPage.editPaymentButtonVisible();
			await paymentsPage.clickEditPaymentButton();
			await paymentsPage.tagsDropdownVisible();
			await paymentsPage.clickTagsDropdown(0);
			await paymentsPage.selectTagFromDropdown(0);
			await paymentsPage.clickCardBody();
			await paymentsPage.projectDropdownVisible();
			await paymentsPage.clickProjectDropdown();
			await paymentsPage.selectProjectFromDropdown(PaymentsPageData.defaultProject);
			await paymentsPage.dateInputVisible();
			await paymentsPage.enterDateInputData();
			await paymentsPage.paymentMethodDropdownVisible();
			await paymentsPage.clickPaymentMethodDropdown();
			await paymentsPage.selectPaymentMethod(PaymentsPageData.defaultPaymentMethod);
			await paymentsPage.amountInputVisible();
			await paymentsPage.enterAmountInputData(String(PaymentsPageData.defaultAmount));
			await paymentsPage.noteTextareaVisible();
			await paymentsPage.enterNoteInputData(PaymentsPageData.defaultNote);
			await paymentsPage.savePaymentButtonVisible();
			await paymentsPage.clickSavePaymentButton();
			await paymentsPage.waitMessageToHide();
		});

		await test.step('Should be able to delete payment', async () => {
			await paymentsPage.tableRowVisible();
			await paymentsPage.selectTableRow(0);
			await paymentsPage.clickDeletePaymentButton();
			await paymentsPage.confirmDeleteButtonVisible();
			await paymentsPage.clickConfirmDeleteButton();
			await paymentsPage.waitMessageToHide();
			await paymentsPage.verifyElementIsDeleted(PaymentsPageData.defaultNote);
		});
	});
});
