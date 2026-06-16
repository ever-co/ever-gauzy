import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import { faker } from '@faker-js/faker';
import * as expensesPage from './support/pages/Expenses.po';
import { ExpensePageData } from '../src/support/Base/pagedata/ExpensesPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from './support/commands';

let name = ' ';

test.describe('Expense test', () => {
	test('Expense test', async () => {
		name = faker.person.firstName();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new expense', async () => {
			await CustomCommands.addProject(
				organizationProjectsPage,
				OrganizationProjectsPageData
			);
			await CustomCommands.addTag(
				organizationTagsUserPage,
				OrganizationTagsPageData
			);
			await getPage().goto('/#/pages/accounting/expenses');
			await expensesPage.gridBtnExists();
			await expensesPage.gridBtnClick(1);
			await expensesPage.addExpenseButtonVisible();
			await expensesPage.clickAddExpenseButton();
			await expensesPage.selectEmployeeDropdownVisible();
			await expensesPage.clickEmployeeDropdown();
			await expensesPage.selectEmployeeFromDropdown(0);
			await expensesPage.categoryInputVisible();
			await expensesPage.clickCategoryInput();
			await expensesPage.enterCategoryInputData(ExpensePageData.defaultCategory);
			await expensesPage.dateInputVisible();
			await expensesPage.enterDateInputData();
			await expensesPage.clickKeyboardButtonByKeyCode(9);
			await expensesPage.vendorInputVisible();
			await expensesPage.clickVendorInput();
			await expensesPage.enterVendorInputData(ExpensePageData.defaultVendor);
			await expensesPage.enterContactInputData(name);
			await expensesPage.amountInputVisible();
			await expensesPage.enterAmountInputData(ExpensePageData.defaultAmount);
			await expensesPage.purposeTextareaVisible();
			await expensesPage.enterPurposeInputData(ExpensePageData.defaultPurpose);
			await expensesPage.projectDropdownVisible();
			await expensesPage.clickProjectDropdown();
			await expensesPage.selectProjectFromDropdown(ExpensePageData.defaultProject);
			await expensesPage.tagsDropdownVisible();
			await expensesPage.clickTagsDropdown();
			await expensesPage.selectTagFromDropdown(0);
			await expensesPage.clickCardBody();
			await expensesPage.saveExpenseButtonVisible();
			await expensesPage.clickSaveExpenseButton();
			await expensesPage.waitMessageToHide();
			await expensesPage.verifyExpenseExists();
		});

		await test.step('Should be able to edit expense', async () => {
			await expensesPage.selectTableRow(0);
			await expensesPage.editExpenseButtonVisible();
			await expensesPage.clickEditExpenseButton();
			await expensesPage.dateInputVisible();
			await expensesPage.enterDateInputData();
			await expensesPage.clickKeyboardButtonByKeyCode(9);
			await expensesPage.purposeTextareaVisible();
			await expensesPage.enterPurposeInputData(ExpensePageData.defaultPurpose);
			await expensesPage.projectDropdownVisible();
			await expensesPage.clickProjectDropdown();
			await expensesPage.selectProjectFromDropdown(ExpensePageData.defaultProject);
			await expensesPage.saveExpenseButtonVisible();
			await expensesPage.clickSaveExpenseButton();
			await expensesPage.waitMessageToHide();
			await expensesPage.verifyExpenseExists();
		});

		await test.step('Should be able to duplicate expense', async () => {
			await expensesPage.waitMessageToHide();
			await expensesPage.selectTableRow(0);
			await expensesPage.duplicateButtonVisible();
			await expensesPage.clickDuplicateButton();
			await expensesPage.saveExpenseButtonVisible();
			await expensesPage.clickSaveExpenseButton();
		});

		await test.step('Should be able to delete expense', async () => {
			await expensesPage.waitMessageToHide();
			await expensesPage.selectTableRow(0);
			await expensesPage.deleteExpenseButtonVisible();
			await expensesPage.clickDeleteExpenseButton();
			await expensesPage.confirmDeleteButtonVisible();
			await expensesPage.clickConfirmDeleteButton();
			await expensesPage.waitMessageToHide();
			await expensesPage.selectTableRow(0);
			await expensesPage.deleteExpenseButtonVisible();
			await expensesPage.clickDeleteExpenseButton();
			await expensesPage.confirmDeleteButtonVisible();
			await expensesPage.clickConfirmDeleteButton();
			await expensesPage.verifyElementIsDeleted();
		});

		await test.step('Should be able to add new category', async () => {
			await expensesPage.waitMessageToHide();
			await expensesPage.manageCategoriesButtonVisible();
			await expensesPage.clickManageCategoriesButton();
			await expensesPage.addExpenseButtonVisible();
			await expensesPage.clickAddExpenseButton();
			await expensesPage.newCategoryInputVisible();
			await expensesPage.enterNewCategoryInputData(ExpensePageData.defaultCategory);
			await expensesPage.tagsDropdownVisible();
			await expensesPage.clickTagsDropdown();
			await expensesPage.selectTagFromDropdown(0);
			await expensesPage.categoryCardVisible();
			await expensesPage.clickKeyboardButtonByKeyCode(9);
			await expensesPage.SaveCategoryButtonVisible();
			await expensesPage.clickSaveCategoryButton();
			await expensesPage.verifyCategoryExists(ExpensePageData.defaultCategory);
			await expensesPage.backButtonVisible();
			await expensesPage.clickBackButton();
		});
	});
});
