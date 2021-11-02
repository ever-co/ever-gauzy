import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickElementByText,
    clickButtonDouble,
	waitElementToHide,
    clickByText,
    verifyByText,
	clickButtonByIndex,
	verifyText,
	enterInputConditionally
} from '../utils/util';
import { EmployeeDashboardPage } from '../pageobjects/EmployeeDashboardPageObject';
import dayjs from 'dayjs';

export const addNewExpenseButtonVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.addNewExpenseButtonCss);
};

export const clickAddNewExpenseButton = () => {
	clickButton(EmployeeDashboardPage.addNewExpenseButtonCss);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.employeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	cy.intercept('GET','/api/employee/working*').as('waitEmployees');
	clickButton(EmployeeDashboardPage.employeeDropdownCss);
	cy.wait('@waitEmployees').then(() => {
		clickButtonDouble(EmployeeDashboardPage.employeeDropdownCss);
	});
};

export const selectEmployeeFromDropdown = (name: string) => {
	clickByText(EmployeeDashboardPage.dropdownOptionCss, name);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const expenseDropdownVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.expenseDropdownCss);
};

export const clickExpenseDropdown = () => {
	clickButton(EmployeeDashboardPage.expenseDropdownCss);
};

export const selectExpenseOptionDropdown = (text) => {
	clickElementByText(EmployeeDashboardPage.dropdownOptionCss, text);
};

export const expenseValueInputVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.valueInputCss);
};

export const enterExpenseValueInputData = (data) => {
	clearField(EmployeeDashboardPage.valueInputCss);
	enterInput(EmployeeDashboardPage.valueInputCss, data);
};

export const saveExpenseButtonVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.saveExpenseButtonCss);
};

export const clickSaveExpenseButton = () => {
	clickButton(EmployeeDashboardPage.saveExpenseButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(EmployeeDashboardPage.toastrMessageCss);
};

export const verifyMenuBtnByText = (text: string) => {
    verifyByText(EmployeeDashboardPage.menuButtonsCss, text)
}

export const clickMenuButtonsByText = (text: string) => {
    clickElementByText(EmployeeDashboardPage.menuButtonsCss, text)
}

export const verifyEmployeeSelecor = () => {
    verifyElementIsVisible(EmployeeDashboardPage.employeeSelectorCss)
}

export const clickOnEmployeeSelecor = () => {
    clickButton(EmployeeDashboardPage.employeeSelectorCss);
    clickButtonDouble(EmployeeDashboardPage.employeeSelectorCss);
};

export const verifyEmployeeSelectorDropdown = (text: string) => {
    verifyByText(EmployeeDashboardPage.selectEmployeeDropdownOptionCss, text);
};

export const clickOnEmployeeSelecorDropdown = (text: string) => {
    clickByText(EmployeeDashboardPage.selectEmployeeDropdownOptionCss, text);
};

export const verifyEmployeeSalary = (salary: string) => {
    verifyByText(EmployeeDashboardPage.salaryCss, salary);
};

export const clickOnIncomeBtn= () => {
	cy.intercept('GET', 'api/organization-contact*').as('waitOrganization');
	clickButton(EmployeeDashboardPage.incomeBtn);
	cy.wait('@waitOrganization');
};

export const verifyIncomeAddButton = () => {
	verifyElementIsVisible(EmployeeDashboardPage.addNewIncomeBtnCss);
};

export const clickIncomeAddButton = () => {
	clickButton(EmployeeDashboardPage.addNewIncomeBtnCss);
}

export const gridBtnExists = () => {
	verifyElementIsVisible(EmployeeDashboardPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(EmployeeDashboardPage.gridButtonCss, index);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.selectEmployeeDropdownCss);
};

export const clickEmployeeSelector = () => {
	clickButton(EmployeeDashboardPage.selectEmployeeDropdownCss);
	clickButtonDouble(EmployeeDashboardPage.selectEmployeeDropdownCss);

};

export const selectEmployeeFromDrodpwonByName = (name: string) => {
	clickByText(EmployeeDashboardPage.selectEmployeeDropdownOptCss, name);
};

export const dateInputVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.dateInputCss);
};

export const enterDateInputData = () => {
	clearField(EmployeeDashboardPage.dateInputCss);
	const date = dayjs().format('MMM D, YYYY');
	enterInput(EmployeeDashboardPage.dateInputCss, date);
};

export const contactInputVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.organizationContactCss);
};

export const clickContactInput = () => {
	clickButton(EmployeeDashboardPage.organizationContactCss);
};

export const enterContactInputData = (data) => {
	enterInputConditionally(EmployeeDashboardPage.organizationContactCss, data);
};

export const amountInputVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.amountInputCss);
};

export const enterAmountInputData = (data) => {
	clearField(EmployeeDashboardPage.amountInputCss);
	enterInput(EmployeeDashboardPage.amountInputCss, data);
};

export const tagsDropdownVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.addTagsDropdownCss);
};

export const clickTagsDropdwon = () => {
	clickButton(EmployeeDashboardPage.addTagsDropdownCss);
};

export const selectTagFromDropdown = (index) => {
	clickButtonByIndex(EmployeeDashboardPage.tagsDropdownOption, index);
};

export const notesTextareaVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.notesInputCss);
};

export const enterNotesInputData = (data) => {
	clearField(EmployeeDashboardPage.notesInputCss);
	enterInput(EmployeeDashboardPage.notesInputCss, data);
};

export const saveIncomeButtonVisible = () => {
	verifyElementIsVisible(EmployeeDashboardPage.saveIncomeButtonCss);
};

export const clickSaveIncomeButton = () => {
	clickButton(EmployeeDashboardPage.saveIncomeButtonCss);
};

export const verifyIncomeExists = (text) => {
	verifyText(EmployeeDashboardPage.verifyIncomeCss, text);
};

export const verifyEmployeeIncome = (text: string) => {
	verifyByText(EmployeeDashboardPage.verifyDashboardIncomeCss, text)
};

export const verifyEmployeeBonus = (text: string) => {
	verifyByText(EmployeeDashboardPage.verifyDashboardBonusCss, text)
}

export const clickOnCurrencyField = () => {
	clickButton(EmployeeDashboardPage.currencyFieldCss)
};

export const selectCurrency = (currency: string) => {
	clickByText(EmployeeDashboardPage.currenctOptionCss, currency)
};