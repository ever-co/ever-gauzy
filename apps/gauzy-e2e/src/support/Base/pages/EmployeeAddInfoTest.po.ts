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
	scrollDown
	
} from '../utils/util';
import { EmployeeAddInfoPage } from '../pageobjects/EmployeeAddInfoPageObject';

export const gridBtnExists = () => {
	cy.intercept('GET','/api/employee-level*').as('waitLevel');
	cy.wait('@waitLevel');
	verifyElementIsVisible(EmployeeAddInfoPage.gridButtonCss);

};

export const gridBtnClick = (index) => {
	clickButtonByIndex(EmployeeAddInfoPage.gridButtonCss, index);
};

export const addNewLevelButtonVisible = () => {
	verifyElementIsVisible(EmployeeAddInfoPage.addNewLevelButtonCss);
};

export const clickAddNewLevelButton = () => {
	clickButton(EmployeeAddInfoPage.addNewLevelButtonCss);
};

export const cancelNewLevelButtonVisible = () => {
	verifyElementIsVisible(EmployeeAddInfoPage.cancelNewLevelButtonCss);
};

export const clickCancelNewLevelButton = () => {
	clickButton(EmployeeAddInfoPage.cancelNewLevelButtonCss);
};

export const newLevelInputVisible = () => {
	verifyElementIsVisible(EmployeeAddInfoPage.newLevelInputCss);
};

export const enterNewLevelData = (data) => {
	clickButton(EmployeeAddInfoPage.newLevelInputCss);
	enterInput(EmployeeAddInfoPage.newLevelInputCss, data);
};

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(EmployeeAddInfoPage.tagsSelectCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(EmployeeAddInfoPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(EmployeeAddInfoPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveNewLevelButtonVisible = () => {
	verifyElementIsVisible(EmployeeAddInfoPage.saveNewLevelButtonCss);
};

export const clickSaveNewLevelButton = () => {
	clickButton(EmployeeAddInfoPage.saveNewLevelButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(EmployeeAddInfoPage.toastrMessageCss);
};

export const verifyMenuBtnByText = (text: string) => {
    verifyByText(EmployeeAddInfoPage.menuButtonsCss, text)
}

export const clickMenuButtonsByText = (text: string) => {
    clickElementByText(EmployeeAddInfoPage.menuButtonsCss, text)
}

export const verifyEmployeeSelecor = () => {
    verifyElementIsVisible(EmployeeAddInfoPage.employeeSelectorCss)
}

export const clickOnEmployeeSelecor = () => {
    clickButton(EmployeeAddInfoPage.employeeSelectorCss);
    clickButtonDouble(EmployeeAddInfoPage.employeeSelectorCss);
};

export const verifyEmployeeSelectorDropdown = (text: string) => {
    verifyByText(EmployeeAddInfoPage.selectEmployeeDropdownOptionCss, text);
};

export const clickOnEmployeeSelecorDropdown = (text: string) => {
    clickByText(EmployeeAddInfoPage.selectEmployeeDropdownOptionCss, text);
};

export const verifyEditIconButton = () => {
	verifyElementIsVisible(EmployeeAddInfoPage.editIconBtnCss);
};

export const clickOnEditIconButton = () => {
	cy.intercept('GET', '/api/employee/*').as('waitEmployee');
	cy.intercept('GET', '/api/employee/working/count*').as('waitCount');
	clickButton(EmployeeAddInfoPage.editIconBtnCss);
	cy.wait(['@waitEmployee', '@waitCount']);
};

export const verifyTab = (text: string) => {
	verifyByText(EmployeeAddInfoPage.tabBtnCss, text);
};

export const clickTab = (text: string) => {
	clickByText(EmployeeAddInfoPage.tabBtnCss, text);
};

export const verifyInputField = () => {
	verifyElementIsVisible(EmployeeAddInfoPage.shortDecsInputCss)
};

export const enterInputField = (text: string) => {
	clearField(EmployeeAddInfoPage.shortDecsInputCss);
	enterInput(EmployeeAddInfoPage.shortDecsInputCss, text);
};

export const verifyLevelInput = () => {
	scrollDown(EmployeeAddInfoPage.formCss);
	verifyElementIsVisible(EmployeeAddInfoPage.levelInputFieldCss)
};

export const clickOnLevelInput = () => {
	clickButton(EmployeeAddInfoPage.levelInputFieldCss);
};

export const clickOnLevelOptions = (text: string) => {
	clickByText(EmployeeAddInfoPage.levelDropdownOptCss, text);
};

export const verifySaveBtn = () => {
	scrollDown(EmployeeAddInfoPage.formCss);
	verifyElementIsVisible(EmployeeAddInfoPage.saveBtnCss);
};

export const clickOnSaveBtn = () => {
	clickButton(EmployeeAddInfoPage.saveBtnCss);
};

export const verifyInfo = (text: string) => {
	verifyByText(EmployeeAddInfoPage.shortDecsCss, text);
}