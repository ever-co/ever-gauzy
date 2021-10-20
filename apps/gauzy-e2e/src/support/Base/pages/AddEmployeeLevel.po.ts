import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyTextNotExisting,
	getLastElement,
	waitElementToHide,
	verifyValue
} from '../utils/util';
import { AddEmployeeLevelPage } from '../pageobjects/AddEmployeeLevelPageObject';

export const gridBtnExists = () => {
	cy.intercept('GET','/api/employee-level*').as('waitLevel');
	cy.wait('@waitLevel');
	verifyElementIsVisible(AddEmployeeLevelPage.gridButtonCss);

};

export const gridBtnClick = (index) => {
	clickButtonByIndex(AddEmployeeLevelPage.gridButtonCss, index);
};

export const addNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const clickAddNewLevelButton = () => {
	clickButton(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const cancelNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const clickCancelNewLevelButton = () => {
	clickButton(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const newLevelInputVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.newLevelInputCss);
};

export const enterNewLevelData = (data) => {
	clickButton(AddEmployeeLevelPage.newLevelInputCss);
	enterInput(AddEmployeeLevelPage.newLevelInputCss, data);
};

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.tagsSelectCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(AddEmployeeLevelPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(AddEmployeeLevelPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const saveNewLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.saveNewLevelButtonCss);
};

export const clickSaveNewLevelButton = () => {
	clickButton(AddEmployeeLevelPage.saveNewLevelButtonCss);
};

export const editEmployeeLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.editEmployeeLevelButtonCss);
};

export const clickEditEmployeeLevelButton = () => {
	getLastElement(AddEmployeeLevelPage.editEmployeeLevelButtonCss);
};

export const editEmployeeLevelInpuVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.editLevelInputCss);
};

export const enterEditLevelData = (data) => {
	clearField(AddEmployeeLevelPage.editLevelInputCss);
	enterInput(AddEmployeeLevelPage.editLevelInputCss, data);
};

export const deleteLevelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.removeEmployeeLevelButtonCss);
};

export const clickDeleteLevelButton = () => {
	getLastElement(AddEmployeeLevelPage.removeEmployeeLevelButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};

export const clickConfirmDeleteLevelButton = () => {
	clickButton(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};

export const verifyTitleExists = (text) => {
	verifyValue(AddEmployeeLevelPage.editLevelInputCss, text);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(AddEmployeeLevelPage.verifyTextCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(AddEmployeeLevelPage.toastrMessageCss);
};

export const cancelButtonVisible = () => {
	verifyElementIsVisible(AddEmployeeLevelPage.cancelButtonCss);
};

export const clickCancelButton = () => {
	clickButton(AddEmployeeLevelPage.cancelButtonCss);
};
