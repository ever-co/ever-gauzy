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
	verifyValue,
	wait
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddEmployeeLevelPage } from '../../../src/support/Base/pageobjects/AddEmployeeLevelPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.gridButtonCss);
};

export const gridBtnClick = async (index: number) => {
	await clickButtonByIndex(AddEmployeeLevelPage.gridButtonCss, index);
};

export const addNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const clickAddNewLevelButton = async () => {
	await clickButton(AddEmployeeLevelPage.addNewLevelButtonCss);
};

export const cancelNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const clickCancelNewLevelButton = async () => {
	await clickButton(AddEmployeeLevelPage.cancelNewLevelButtonCss);
};

export const newLevelInputVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.newLevelInputCss);
};

export const enterNewLevelData = async (data: string) => {
	await clickButton(AddEmployeeLevelPage.newLevelInputCss);
	await enterInput(AddEmployeeLevelPage.newLevelInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(AddEmployeeLevelPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickButtonByIndex(AddEmployeeLevelPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.updateLevelButtonCss);
};

export const clickSaveNewLevelButton = async () => {
	await clickButton(AddEmployeeLevelPage.updateLevelButtonCss);
};

export const editEmployeeLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.editEmployeeLevelButtonCss);
};

export const clickRowEmployeeLevel = async () => {
	await getLastElement(AddEmployeeLevelPage.selectEmployeeLevelRow);
};

export const clickRowEmployeeLevelToDelete = async () => {
	await getLastElement(AddEmployeeLevelPage.selectEmployeeLevelRowtoDelete);
};

export const clickRowEmployeeLevelTwice = async () => {
	await clickButton(AddEmployeeLevelPage.selectEmployeeLevelRow);
	await wait(500);
	await clickButton(AddEmployeeLevelPage.selectEmployeeLevelRow);
};

export const clickEditEmployeeLevelButton = async () => {
	await getLastElement(AddEmployeeLevelPage.editEmployeeLevelButtonCss);
};

export const editEmployeeLevelInpuVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.editLevelInputCss);
};

export const enterEditLevelData = async (data: string) => {
	await clearField(AddEmployeeLevelPage.editLevelInputCss);
	await enterInput(AddEmployeeLevelPage.editLevelInputCss, data);
};

export const deleteLevelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.removeEmployeeLevelButtonCss);
};

export const clickDeleteLevelButton = async () => {
	await getLastElement(AddEmployeeLevelPage.removeEmployeeLevelButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};

export const clickConfirmDeleteLevelButton = async () => {
	await clickButton(AddEmployeeLevelPage.confirmDeleteLevelButtonCss);
};

export const verifyTitleExists = async (text: string) => {
	await verifyValue(AddEmployeeLevelPage.editLevelInputCss, text);
};

export const verifyElementIsDeleted = async (text: string) => {
	await verifyTextNotExisting(AddEmployeeLevelPage.verifyTextCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddEmployeeLevelPage.toastrMessageCss);
};

export const cancelButtonVisible = async () => {
	await verifyElementIsVisible(AddEmployeeLevelPage.cancelButtonCss);
};

export const clickCancelButton = async () => {
	await clickButton(AddEmployeeLevelPage.cancelButtonCss);
};
