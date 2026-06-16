import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyByLength
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { GoalsKPIPage } from '../../../src/support/Base/pageobjects/GoalsKPIPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const tabButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.tabButtonCss);
};

export const clickTabButton = async (index) => {
	await clickButtonByIndex(GoalsKPIPage.tabButtonCss, index);
};

export const addKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.addKPIButtonCss);
};

export const clickAddKPIButton = async () => {
	await clickButton(GoalsKPIPage.addKPIButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.kpiTitleInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(GoalsKPIPage.kpiTitleInputCss);
	await enterInput(GoalsKPIPage.kpiTitleInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.kpiDescriptionInputCss);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(GoalsKPIPage.kpiDescriptionInputCss);
	await enterInput(GoalsKPIPage.kpiDescriptionInputCss, data);
};

export const employeeMultiSelectVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.employeeMultiSelectCss);
};

export const clickEmployeeMultiSelect = async () => {
	await clickButton(GoalsKPIPage.employeeMultiSelectCss);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.employeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (index) => {
	await clickButtonByIndex(GoalsKPIPage.employeeDropdownCss, index);
};

export const valueInputVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.currentValueInputCss);
};

export const enterValueInputData = async (data) => {
	await clearField(GoalsKPIPage.currentValueInputCss);
	await enterInput(GoalsKPIPage.currentValueInputCss, data);
};

export const saveKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.saveKPIButtonCss);
};

export const clickSaveKPIButton = async () => {
	await clickButton(GoalsKPIPage.saveKPIButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(GoalsKPIPage.selectTableRowCss, index);
};

export const editKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.editButtonCss);
};

export const clickEditKPIButton = async () => {
	await clickButton(GoalsKPIPage.editButtonCss);
};

export const deleteKPIButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.deleteButtonCss);
};

export const clickDeleteKPIButton = async () => {
	await clickButton(GoalsKPIPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(GoalsKPIPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(GoalsKPIPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(GoalsKPIPage.toastrMessageCss);
};

export const verifyElementDeleted = async (text) => {
	await verifyText(GoalsKPIPage.verifyEmptyTableCss, text);
};

export const verifyKPIExists = async (text) => {
	await verifyText(GoalsKPIPage.verifyKPICss, text);
};

export const verifyNameInput = async () => {
	await verifyElementIsVisible(GoalsKPIPage.searchNameInputCss);
};

export const searchClientName = async (name: string) => {
	await clearField(GoalsKPIPage.searchNameInputCss);
	await enterInput(GoalsKPIPage.searchNameInputCss, name);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(GoalsKPIPage.selectTableRowCss, length);
};
