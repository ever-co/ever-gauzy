import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as faker from 'faker';
import * as paymentsPage from '../support/Base/pages/Payments.po';
import { PaymentsPageData } from '../support/Base/pagedata/PaymentsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as addTaskPage from '../support/Base/pages/AddTasks.po';
import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';

describe('Payments test', () => {
	before(() => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should able to add new payment', () => {
		cy.visit('/#/pages/organization/projects');
		addTaskPage.requestProjectButtonVisible();
		addTaskPage.clickRequestProjectButton();
		addTaskPage.projectNameInputVisible();
		addTaskPage.enterProjectNameInputData(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.clickSelectEmployeeDropdown();
		addTaskPage.selectEmployeeDropdownOption(1);
		addTaskPage.selectEmployeeDropdownOption(2);
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.saveProjectButtonVisible();
		addTaskPage.clickSaveProjectButton();
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton(1);
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tageName
		);
		organizationTagsUserPage.tagColorInputVisible();
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.tagDescriptionTextareaVisible();
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
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
		cy.wait(3000);
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
		cy.wait(3000);
	});
	it('Should be able to delete payment', () => {
		paymentsPage.tableRowVisible();
		paymentsPage.selectTableRow(0);
		paymentsPage.clickDeletePaymentButton();
		paymentsPage.confirmDeleteButtonVisible();
		paymentsPage.clickConfirmDeleteButton();
	});
});
