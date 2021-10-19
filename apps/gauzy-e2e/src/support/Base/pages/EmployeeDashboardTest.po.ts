import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
    clickButtonDouble,
	waitElementToHide,
    clickByText,
	clickButtonByText,
	verifyValue,
	verifyTextNotExisting,
	scrollDown,
	verifyElementIsNotVisible,
	waitUntil,
    verifyByText
} from '../utils/util';
import { EmployeeDashboardPage } from '../pageobjects/EmployeeDashboardPageObject';
import { verify } from 'cypress/types/sinon';


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

export const verifyDashboardButton = (text: string) => {
    verifyByText(EmployeeDashboardPage.menuDashboardButtonCss, text)
}

export const clickOnDashboardButton = (text: string) => {
    clickElementByText(EmployeeDashboardPage.menuDashboardButtonCss, text)
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
