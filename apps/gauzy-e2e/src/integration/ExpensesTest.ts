import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as faker from 'faker';
import * as expensesPage from '../support/Base/pages/Expenses.po';
import { ExpensePageData } from '../support/Base/pagedata/ExpensesPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';

let name = ' ';

describe('Expense test', () => {
	before(() => {
		name = faker.name.firstName();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new expense', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
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
		expensesPage.waitMessageToHide();
		expensesPage.selectTableRow(0);
		expensesPage.duplicateButtonVisible();
		expensesPage.clickDuplicateButton();
		expensesPage.saveExpenseButtonVisible();
		expensesPage.clickSaveExpenseButton();
	});
	it('Should be able to delete expense', () => {
		expensesPage.waitMessageToHide();
		expensesPage.selectTableRow(0);
		expensesPage.deleteExpenseButtonVisible();
		expensesPage.clickDeleteExpenseButton();
		expensesPage.confirmDeleteButtonVisible();
		expensesPage.clickConfirmDeleteButton();
	});
	it('Should be able to add new categorie', () => {
		expensesPage.waitMessageToHide();
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
