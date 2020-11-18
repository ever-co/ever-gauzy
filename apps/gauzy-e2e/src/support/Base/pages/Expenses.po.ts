import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	enterInputConditionally,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide
} from '../utils/util';
import { ExpensesPage } from '../pageobjects/ExpensesPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(ExpensesPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ExpensesPage.gridButtonCss, index);
};

export const addExpenseButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.addExpenseButtonCss);
};

export const clickAddExpenseButton = () => {
	clickButton(ExpensesPage.addExpenseButtonCss);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(ExpensesPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(ExpensesPage.selectEmployeeDropdownCss);
};

export const selectEmployeeFromDrodpwon = (index) => {
	clickButtonByIndex(ExpensesPage.selectEmployeeDropdownOptionCss, index);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(ExpensesPage.dateInputCss);
};

export const enterDateInputData = () => {
	clearField(ExpensesPage.dateInputCss);
	const date = Cypress.moment().format('MMM D, YYYY');
	enterInput(ExpensesPage.dateInputCss, date);
};

export const contactInputVisible = () => {
	verifyElementIsVisible(ExpensesPage.organizationContactCss);
};

export const clickContactInput = () => {
	clickButton(ExpensesPage.organizationContactCss);
};

export const enterContactInputData = (data) => {
	enterInputConditionally(ExpensesPage.organizationContactCss, data);
};

export const categoryInputVisible = () => {
	verifyElementIsVisible(ExpensesPage.categoryInputCss);
};

export const clickCategoryInput = () => {
	clickButton(ExpensesPage.categoryInputCss);
};

export const enterCategoryInputData = (data) => {
	enterInputConditionally(ExpensesPage.categoryInputCss, data);
};

export const vendorInputVisible = () => {
	verifyElementIsVisible(ExpensesPage.vendorInputCss);
};

export const clickVendorInput = () => {
	clickButton(ExpensesPage.vendorInputCss);
};

export const enterVendorInputData = (data) => {
	enterInputConditionally(ExpensesPage.vendorInputCss, data);
};

export const amountInputVisible = () => {
	verifyElementIsVisible(ExpensesPage.amountInputCss);
};

export const enterAmountInputData = (data) => {
	clearField(ExpensesPage.amountInputCss);
	enterInput(ExpensesPage.amountInputCss, data);
};

export const projectDropdownVisible = () => {
	verifyElementIsVisible(ExpensesPage.projectDropdownCss);
};

export const clickProjectDropdown = () => {
	clickButton(ExpensesPage.projectDropdownCss);
};

export const selectProjectFromDropdown = (text) => {
	clickElementByText(ExpensesPage.projectDropdownOptionCss, text);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(ExpensesPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(ExpensesPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(ExpensesPage.tagsDropdownOption, index);
};

export const purposeTextareaVisible = () => {
	verifyElementIsVisible(ExpensesPage.purposeInputCss);
};

export const enterPurposeInputData = (data) => {
	clearField(ExpensesPage.purposeInputCss);
	enterInput(ExpensesPage.purposeInputCss, data);
};

export const saveExpenseButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.saveExpenseButtonCss);
};

export const clickSaveExpenseButton = () => {
	clickButton(ExpensesPage.saveExpenseButtonCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(ExpensesPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(ExpensesPage.selectTableRowCss, index);
};

export const editExpenseButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.editExpenseButtonCss);
};

export const clickEditExpenseButton = () => {
	clickButton(ExpensesPage.editExpenseButtonCss);
};

export const deleteExpenseButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.deleteExpenseButtonCss);
};

export const clickDeleteExpenseButton = () => {
	clickButton(ExpensesPage.deleteExpenseButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(ExpensesPage.confirmDeleteButtonCss);
};

export const clickCardBody = () => {
	clickButton(ExpensesPage.cardBodyCss);
};

export const duplicateButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.duplicateExpenseButtonCss);
};

export const clickDuplicateButton = () => {
	clickButton(ExpensesPage.duplicateExpenseButtonCss);
};

export const manageCategoriesButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.manageCategoriseButtonCss);
};

export const clickManageCategoriesButton = () => {
	clickButton(ExpensesPage.manageCategoriseButtonCss);
};

export const newCategoryInputVisible = () => {
	verifyElementIsVisible(ExpensesPage.expenseNameInputCss);
};

export const enterNewCategoryInputData = (data) => {
	clearField(ExpensesPage.expenseNameInputCss);
	enterInput(ExpensesPage.expenseNameInputCss, data);
};

export const saveCategorieButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.saveCategorieButtonCss);
};

export const clickSaveCategorieButton = () => {
	clickButton(ExpensesPage.saveCategorieButtonCss);
};

export const backButtonVisible = () => {
	verifyElementIsVisible(ExpensesPage.backButtonCss);
};

export const clickBackButton = () => {
	clickButton(ExpensesPage.backButtonCss);
};

export const categorieCardVisible = () => {
	verifyElementIsVisible(ExpensesPage.categorieCardCss);
};

export const clickCategorieCard = () => {
	clickButton(ExpensesPage.categorieCardCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(ExpensesPage.toastrMessageCss);
};
