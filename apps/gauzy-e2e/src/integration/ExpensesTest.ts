import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as faker from 'faker';
import * as expensesPage from '../support/Base/pages/Expenses.po';
import { ExpensePageData } from '../support/Base/pagedata/ExpensesPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as addTaskPage from '../support/Base/pages/AddTasks.po';
import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';

let name = ' ';

describe('Expense test', () => {
	before(() => {
		name = faker.name.firstName();

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

	it('Should be able to add new expense', () => {
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
		cy.visit('/#/pages/accounting/expenses');
		expensesPage.gridBtnExists();
		expensesPage.gridBtnClick(1);
		expensesPage.addExpenseButtonVisible();
		expensesPage.clickAddExpenseButton();
		expensesPage.selectEmployeeDropdownVisible();
		expensesPage.clickEmployeeDropdown();
		expensesPage.selectEmployeeFromDrodpwon(0);
		expensesPage.categoryInputVisible();
		expensesPage.clickCategoryInput();
		expensesPage.enterCategoryInputData(ExpensePageData.defaultCategory);
		expensesPage.dateInputVisible();
		expensesPage.enterDateInputData();
		expensesPage.clickKeyboardButtonByKeyCode(9);
		expensesPage.vendorInputVisible();
		expensesPage.clickVendorInput();
		expensesPage.enterVendorInputData(ExpensePageData.defaultVendor);
		expensesPage.enterContactInputData(name);
		expensesPage.amountInputVisible();
		expensesPage.enterAmountInputData(ExpensePageData.defaultAmount);
		expensesPage.purposeTextareaVisible();
		expensesPage.enterPurposeInputData(ExpensePageData.defaultPurpose);
		expensesPage.projectDropdownVisible();
		expensesPage.clickProjectDropdown();
		expensesPage.selectProjectFromDropdown(ExpensePageData.defaultProject);
		expensesPage.tagsDropdownVisible();
		expensesPage.clickTagsDropdwon();
		expensesPage.selectTagFromDropdown(0);
		expensesPage.clickCardBody();
		expensesPage.saveExpenseButtonVisible();
		expensesPage.clickSaveExpenseButton();
	});
	it('Should be able to edit expense', () => {
		expensesPage.selectTableRow(0);
		expensesPage.editExpenseButtonVisible();
		expensesPage.clickEditExpenseButton();
		expensesPage.dateInputVisible();
		expensesPage.enterDateInputData();
		expensesPage.clickKeyboardButtonByKeyCode(9);
		expensesPage.purposeTextareaVisible();
		expensesPage.enterPurposeInputData(ExpensePageData.defaultPurpose);
		expensesPage.projectDropdownVisible();
		expensesPage.clickProjectDropdown();
		expensesPage.selectProjectFromDropdown(ExpensePageData.defaultProject);
		expensesPage.saveExpenseButtonVisible();
		expensesPage.clickSaveExpenseButton();
	});
	it('Should be able to duplicate expense', () => {
		cy.wait(3000);
		expensesPage.selectTableRow(0);
		expensesPage.duplicateButtonVisible();
		expensesPage.clickDuplicateButton();
		expensesPage.saveExpenseButtonVisible();
		expensesPage.clickSaveExpenseButton();
	});
	it('Should be able to delete expense', () => {
		cy.wait(3000);
		expensesPage.selectTableRow(0);
		expensesPage.deleteExpenseButtonVisible();
		expensesPage.clickDeleteExpenseButton();
		expensesPage.confirmDeleteButtonVisible();
		expensesPage.clickConfirmDeleteButton();
	});
	it('Should be able to add new categorie', () => {
		expensesPage.manageCategoriesButtonVisible();
		expensesPage.clickManageCategoriesButton();
		expensesPage.addExpenseButtonVisible();
		expensesPage.clickAddExpenseButton();
		expensesPage.newCategoryInputVisible();
		expensesPage.enterNewCategoryInputData(ExpensePageData.defaultCategory);
		expensesPage.tagsDropdownVisible();
		expensesPage.clickTagsDropdwon();
		expensesPage.selectTagFromDropdown(0);
		expensesPage.categorieCardVisible();
		expensesPage.clickKeyboardButtonByKeyCode(9);
		expensesPage.saveCategorieButtonVisible();
		expensesPage.clickSaveCategorieButton();
		expensesPage.backButtonVisible();
		expensesPage.clickBackButton();
	});
});
