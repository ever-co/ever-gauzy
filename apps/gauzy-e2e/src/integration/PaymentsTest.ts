import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as paymentsPage from '../support/Base/pages/Payments.po';
import { PaymentsPageData } from '../support/Base/pagedata/PaymentsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';

describe('Payments test', () => {
	before(() => {
		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should able to add new payment', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/accounting/payments');
		paymentsPage.gridBtnExists();
		paymentsPage.gridBtnClick(1);
		paymentsPage.addPaymentButtonVisible();
		paymentsPage.clickAddPaymentButton();
		paymentsPage.tagsDropdownVisible();
		paymentsPage.clickTagsDropdwon();
		paymentsPage.selectTagFromDropdown(0);
		paymentsPage.clickCardBody();
		paymentsPage.projectDropdownVisible();
		paymentsPage.clickProjectDropdown();
		paymentsPage.selectProjectFromDropdown(PaymentsPageData.defaultProject);
		paymentsPage.dateInputVisible();
		paymentsPage.enterDateInputData();
		paymentsPage.paymentMethodDropdownVisible();
		paymentsPage.clickPaymentMethodDropdown();
		paymentsPage.selectPaymentMethod(PaymentsPageData.defaultPaymentMethod);
		paymentsPage.amountInputVisible();
		paymentsPage.enterAmountInputData(PaymentsPageData.defaultAmount);
		paymentsPage.noteTextareaVisible();
		paymentsPage.enterNoteInputData(PaymentsPageData.defaultNote);
		paymentsPage.savePaymentButtonVisible();
		paymentsPage.clickSavePaymentButton();
		paymentsPage.waitMessageToHide();
		paymentsPage.verifyPaymentExists(PaymentsPageData.defaultNote);
	});
	it('Should be able to edit payment', () => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		paymentsPage.tableRowVisible();
		paymentsPage.selectTableRow(0);
		paymentsPage.editPaymentButtonVisible();
		paymentsPage.clickEditPaymentButton();
		paymentsPage.tagsDropdownVisible();
		paymentsPage.clickTagsDropdwon();
		paymentsPage.selectTagFromDropdown(0);
		paymentsPage.clickCardBody();
		paymentsPage.projectDropdownVisible();
		paymentsPage.clickProjectDropdown();
		paymentsPage.selectProjectFromDropdown(PaymentsPageData.defaultProject);
		paymentsPage.dateInputVisible();
		paymentsPage.enterDateInputData();
		paymentsPage.paymentMethodDropdownVisible();
		paymentsPage.clickPaymentMethodDropdown();
		paymentsPage.selectPaymentMethod(PaymentsPageData.defaultPaymentMethod);
		paymentsPage.amountInputVisible();
		paymentsPage.enterAmountInputData(PaymentsPageData.defaultAmount);
		paymentsPage.noteTextareaVisible();
		paymentsPage.enterNoteInputData(PaymentsPageData.defaultNote);
		paymentsPage.savePaymentButtonVisible();
		paymentsPage.clickSavePaymentButton();
		paymentsPage.waitMessageToHide();
	});
	it('Should be able to delete payment', () => {
		paymentsPage.tableRowVisible();
		paymentsPage.selectTableRow(0);
		paymentsPage.clickDeletePaymentButton();
		paymentsPage.confirmDeleteButtonVisible();
		paymentsPage.clickConfirmDeleteButton();
		paymentsPage.waitMessageToHide();
		paymentsPage.verifyElementIsDeleted(PaymentsPageData.defaultNote);
	});
});
