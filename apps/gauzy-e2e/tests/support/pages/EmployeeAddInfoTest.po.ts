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
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EmployeeAddInfoPage } from '../../../src/support/Base/pageobjects/EmployeeAddInfoPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.addNewLevelButtonCss);
};

export const clickAddNewLevelButton = async () => {
	await clickButton(EmployeeAddInfoPage.addNewLevelButtonCss);
};

export const cancelNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.cancelNewLevelButtonCss);
};

export const clickCancelNewLevelButton = async () => {
	await clickButton(EmployeeAddInfoPage.cancelNewLevelButtonCss);
};

export const newLevelInputVisible = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.newLevelInputCss);
};

export const enterNewLevelData = async (data: string) => {
	await clickButton(EmployeeAddInfoPage.newLevelInputCss);
	await enterInput(EmployeeAddInfoPage.newLevelInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(EmployeeAddInfoPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	await clickButtonByIndex(EmployeeAddInfoPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const saveNewLevelButtonVisible = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.saveNewLevelButtonCss);
};

export const clickSaveNewLevelButton = async () => {
	await clickButton(EmployeeAddInfoPage.saveNewLevelButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EmployeeAddInfoPage.toastrMessageCss);
};

export const verifyMenuBtnByText = async (text: string) => {
	await verifyByText(EmployeeAddInfoPage.menuButtonsCss, text);
};

export const clickMenuButtonsByText = async (text: string) => {
	await clickElementByText(EmployeeAddInfoPage.menuButtonsCss, text);
};

export const verifyEmployeeSelector = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.employeeSelectorCss);
};

export const clickOnEmployeeSelector = async () => {
	await clickButton(EmployeeAddInfoPage.employeeSelectorCss);
	await clickButtonDouble(EmployeeAddInfoPage.employeeSelectorCss);
};

export const verifyEmployeeSelectorDropdown = async (text: string) => {
	await verifyByText(EmployeeAddInfoPage.selectEmployeeDropdownOptionCss, text);
};

export const clickOnEmployeeSelectorDropdown = async (text: string) => {
	await clickByText(EmployeeAddInfoPage.selectEmployeeDropdownOptionCss, text);
};

export const verifyEditIconButton = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.editIconBtnCss);
};

export const clickOnEditIconButton = async () => {
	await clickButton(EmployeeAddInfoPage.editIconBtnCss);
};

export const verifyTab = async (text: string) => {
	await verifyByText(EmployeeAddInfoPage.tabBtnCss, text);
};

export const clickTab = async (text: string) => {
	await clickByText(EmployeeAddInfoPage.tabBtnCss, text);
};

export const verifyInputField = async () => {
	await verifyElementIsVisible(EmployeeAddInfoPage.shortDecsInputCss);
};

export const enterInputField = async (text: string) => {
	await clearField(EmployeeAddInfoPage.shortDecsInputCss);
	await enterInput(EmployeeAddInfoPage.shortDecsInputCss, text);
};

export const verifyLevelInput = async () => {
	await scrollDown(EmployeeAddInfoPage.formCss);
	await verifyElementIsVisible(EmployeeAddInfoPage.levelInputFieldCss);
};

export const clickOnLevelInput = async () => {
	await clickButton(EmployeeAddInfoPage.levelInputFieldCss);
};

export const clickOnLevelOptions = async (text: string) => {
	await clickByText(EmployeeAddInfoPage.levelDropdownOptCss, text);
};

export const verifySaveBtn = async () => {
	await scrollDown(EmployeeAddInfoPage.formCss);
	await verifyElementIsVisible(EmployeeAddInfoPage.saveBtnCss);
};

export const clickOnSaveBtn = async () => {
	await clickButton(EmployeeAddInfoPage.saveBtnCss);
};

export const verifyInfo = async (text: string) => {
	await verifyByText(EmployeeAddInfoPage.shortDecsCss, text);
};
