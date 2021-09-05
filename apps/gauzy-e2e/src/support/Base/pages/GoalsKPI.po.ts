import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText
} from '../utils/util';
import { GoalsKPIPage } from '../pageobjects/GoalsKPIPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(GoalsKPIPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(GoalsKPIPage.gridButtonCss, index);
};

export const tabButtonVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.tabButtonCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(GoalsKPIPage.tabButtonCss, index);
};

export const addKPIButtonVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.addKPIButtonCss);
};

export const clickAddKPIButton = () => {
	clickButton(GoalsKPIPage.addKPIButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.kpiTitleInputCss);
};

export const enterNameInputData = (data) => {
	clearField(GoalsKPIPage.kpiTitleInputCss);
	enterInput(GoalsKPIPage.kpiTitleInputCss, data);
};

export const descriptionInputVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.kpiDescriptionInputCss);
};

export const enterDescriptionInputData = (data) => {
	clearField(GoalsKPIPage.kpiDescriptionInputCss);
	enterInput(GoalsKPIPage.kpiDescriptionInputCss, data);
};

export const employeeMultiSelectVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.employeeMultiSelectCss);
};

export const clickEmployeeMultiSelect = () => {
	clickButton(GoalsKPIPage.employeeMultiSelectCss);
};

export const employeeDropdownVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.employeeDropdownCss);
};

export const selectEmployeeFromDropdown = (index) => {
	clickButtonByIndex(GoalsKPIPage.employeeDropdownCss, index);
};

export const valueInputVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.currentValueInputCss);
};

export const enterValueInputData = (data) => {
	clearField(GoalsKPIPage.currentValueInputCss);
	enterInput(GoalsKPIPage.currentValueInputCss, data);
};

export const saveKPIButtonVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.saveKPIButtonCss);
};

export const clickSaveKPIButton = () => {
	clickButton(GoalsKPIPage.saveKPIButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(GoalsKPIPage.selectTableRowCss, index);
};

export const editKPIButtonVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.editButtonCss);
};

export const clickEditKPIButton = () => {
	clickButton(GoalsKPIPage.editButtonCss);
};

export const deleteKPIButtonVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.deleteButtonCss);
};

export const clickDeleteKPIButton = () => {
	clickButton(GoalsKPIPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(GoalsKPIPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(GoalsKPIPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(GoalsKPIPage.toastrMessageCss);
};

export const verifyElementDeleted = (text) => {
	verifyText(GoalsKPIPage.verifyEmpytTableCss, text);
};

export const verifyKPIExists = (text) => {
	verifyText(GoalsKPIPage.verifyKPICss, text);
};
