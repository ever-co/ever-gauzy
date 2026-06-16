import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	verifyText,
	verifyElementNotExist,
	waitUntil,
	forceClickElementByText
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { ExpensesPage } from '../../../src/support/Base/pageobjects/ExpensesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.addExpenseButtonCss);
};

export const clickAddExpenseButton = async () => {
	await waitUntil(3000);
	await clickButton(ExpensesPage.addExpenseButtonCss);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	await waitUntil(3000);
	await clickButton(ExpensesPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(ExpensesPage.selectEmployeeDropdownOptionCss, index);
};

export const dateInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.dateInputCss);
};

export const enterDateInputData = async () => {
	await clearField(ExpensesPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	await enterInput(ExpensesPage.dateInputCss, date);
};

export const contactInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.organizationContactCss);
};

export const clickContactInput = async () => {
	await clickButton(ExpensesPage.organizationContactCss);
};

export const enterContactInputData = async (data) => {
	await enterInputConditionally(ExpensesPage.organizationContactCss, data);
};

export const categoryInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.categoryInputCss);
};

export const clickCategoryInput = async () => {
	await clickButton(ExpensesPage.categoryInputCss);
};

export const enterCategoryInputData = async (data) => {
	await enterInputConditionally(ExpensesPage.categoryInputCss, data);
};

export const vendorInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.vendorInputCss);
};

export const clickVendorInput = async () => {
	await clickButton(ExpensesPage.vendorInputCss);
};

export const enterVendorInputData = async (data) => {
	await enterInputConditionally(ExpensesPage.vendorInputCss, data);
};

export const amountInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.amountInputCss);
};

export const enterAmountInputData = async (data) => {
	await clearField(ExpensesPage.amountInputCss);
	await enterInput(ExpensesPage.amountInputCss, data);
};

export const projectDropdownVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.projectDropdownCss);
};

export const clickProjectDropdown = async () => {
	await clickButton(ExpensesPage.projectDropdownCss);
};

export const selectProjectFromDropdown = async (text) => {
	await clickElementByText(ExpensesPage.projectDropdownOptionCss, text);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	await clickButton(ExpensesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = async (index) => {
	await clickButtonByIndex(ExpensesPage.tagsDropdownOption, index);
};

export const purposeTextareaVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.purposeInputCss);
};

export const enterPurposeInputData = async (data) => {
	await clearField(ExpensesPage.purposeInputCss);
	await enterInput(ExpensesPage.purposeInputCss, data);
};

export const saveExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.saveExpenseButtonCss);
};

export const clickSaveExpenseButton = async () => {
	await clickButton(ExpensesPage.saveExpenseButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await waitUntil(3000);
	await clickButtonByIndex(ExpensesPage.selectTableRowCss, index);
};

export const editExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.editExpenseButtonCss);
};

export const clickEditExpenseButton = async () => {
	await clickButton(ExpensesPage.editExpenseButtonCss);
};

export const deleteExpenseButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.deleteExpenseButtonCss);
};

export const clickDeleteExpenseButton = async () => {
	await clickButton(ExpensesPage.deleteExpenseButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(ExpensesPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	await clickButton(ExpensesPage.cardBodyCss);
};

export const duplicateButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.duplicateExpenseButtonCss);
};

export const clickDuplicateButton = async () => {
	await clickButton(ExpensesPage.duplicateExpenseButtonCss);
};

export const manageCategoriesButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.manageCategoriesButtonCss);
};

export const clickManageCategoriesButton = async () => {
	await clickButton(ExpensesPage.manageCategoriesButtonCss);
};

export const newCategoryInputVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.expenseNameInputCss);
};

export const enterNewCategoryInputData = async (data) => {
	await clearField(ExpensesPage.expenseNameInputCss);
	await enterInput(ExpensesPage.expenseNameInputCss, data);
};

export const SaveCategoryButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.SaveCategoryButtonCss);
};

export const clickSaveCategoryButton = async () => {
	await clickButton(ExpensesPage.SaveCategoryButtonCss);
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(ExpensesPage.backButtonCss);
};

export const categoryCardVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.categoryCardCss);
};

export const clickCategoryCard = async () => {
	await clickButton(ExpensesPage.categoryCardCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(ExpensesPage.toastrMessageCss);
};

export const verifyExpenseExists = async () => {
	await verifyElementIsVisible(ExpensesPage.notBillableBadgeCss);
};

export const verifyElementIsDeleted = async () => {
	await verifyElementNotExist(ExpensesPage.notBillableBadgeCss);
};

export const verifyCategoryExists = async (text) => {
	await verifyText(ExpensesPage.verifyCategoryCss, text);
};

export const sidebarBtnVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.sidebarBtnCss);
};

export const clickSidebarBtn = async (text) => {
	await clickElementByText(ExpensesPage.sidebarBtnCss, text);
};

export const clickAccountingExpensesSidebarBtn = async (text) => {
	await forceClickElementByText(ExpensesPage.accountingExpensesSidebarBtnCss, text);
};

export const clickReportsInnerSidebarBtn = async (text) => {
	await forceClickElementByText(ExpensesPage.reportsExpenseSidebarBtnCss, text);
};

export const verifyExpenseProject = async (project) => {
	await verifyText(ExpensesPage.expenseTableCellCss, project);
};

export const verifyExpenseAmount = async (amount) => {
	await verifyText(ExpensesPage.amountTableCellCss, amount);
};

export const groupBySelectVisible = async () => {
	await verifyElementIsVisible(ExpensesPage.groupByCss);
};

export const clickGroupBySelect = async () => {
	await clickButton(ExpensesPage.groupByCss);
};

export const verifyDropdownOption = async (text) => {
	await verifyText(ExpensesPage.dropdownOptionCss, text);
};

export const selectOptionFromDropdown = async (text) => {
	await clickElementByText(ExpensesPage.dropdownOptionCss, text);
};
