import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickElementByText,
	verifyText,
	verifyElementNotExist,
	waitUntil
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { GoalsPage } from '../../../src/support/Base/pageobjects/GoalsPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.addButtonCss);
};

export const clickAddButton = async (index) => {
	await clickButtonByIndex(GoalsPage.addButtonCss, index);
};

export const selectOptionFromDropdown = async (index) => {
	await clickButtonByIndex(GoalsPage.optionDropdownCss, index);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.nameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(GoalsPage.nameInputCss);
	await enterInput(GoalsPage.nameInputCss, data);
};

export const ownerDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.ownerDropdownCss);
};

export const clickOwnerDropdown = async () => {
	await clickButton(GoalsPage.ownerDropdownCss);
};

export const selectOwnerFromDropdown = async (index) => {
	await clickButtonByIndex(GoalsPage.dropdownOptionCss, index);
};

export const leadDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.leadDropdownCss);
};

export const clickLeadDropdown = async () => {
	await clickButton(GoalsPage.leadDropdownCss);
};

export const selectLeadFromDropdown = async (index) => {
	await clickButtonByIndex(GoalsPage.dropdownOptionCss, index);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.confirmButtonCss);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.editButtonCss);
};

export const clickEditButton = async (index) => {
	await clickButtonByIndex(GoalsPage.editButtonCss, index);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.viewButtonCss);
};

export const clickViewButton = async (index) => {
	await clickButtonByIndex(GoalsPage.viewButtonCss, index);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	await clickButton(GoalsPage.deleteButtonCss);
};

export const clickConfirmButton = async () => {
	await clickButton(GoalsPage.confirmButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(GoalsPage.toastrMessageCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(GoalsPage.tableRowCss);
};

export const clickTableRow = async (index) => {
	await waitUntil(3000);
	await clickButtonByIndex(GoalsPage.tableRowCss, index);
};

export const keyResultInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultInputCss);
};

export const enterKeyResultNameData = async (data) => {
	await clearField(GoalsPage.keyResultInputCss);
	await enterInput(GoalsPage.keyResultInputCss, data);
};

export const initialValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.initialValueCss);
};

export const enterInitialValueData = async (data) => {
	await clearField(GoalsPage.initialValueCss);
	await enterInput(GoalsPage.initialValueCss, data);
};

export const targetValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.targetValueCss);
};

export const enterTargetValueData = async (data) => {
	await clearField(GoalsPage.targetValueCss);
	await enterInput(GoalsPage.targetValueCss, data);
};

export const keyResultOwnerDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultOwnerCss);
};

export const clickKeyResultOwnerDropdown = async () => {
	await clickButton(GoalsPage.keyResultOwnerCss);
};

export const selectKeyResultOwnerFromDropdown = async (index) => {
	await clickButtonByIndex(GoalsPage.dropdownOptionCss, index);
};

export const keyResultLeadDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.keyResultLeadCss);
};

export const clickKeyResultLeadDropdown = async () => {
	await clickButton(GoalsPage.keyResultLeadCss);
};

export const selectKeyResultLeadFromDropdown = async (index) => {
	await clickButtonByIndex(GoalsPage.dropdownOptionCss, index);
};

export const toggleButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.toggleButtonCss);
};

export const clickToggleButton = async () => {
	await clickButton(GoalsPage.toggleButtonCss);
};

export const addNewDeadlineButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.addDeadlineButtonCss);
};

export const clickAddDeadlineButton = async () => {
	await clickButton(GoalsPage.addDeadlineButtonCss);
};

export const updatedValueInputVisible = async () => {
	await verifyElementIsVisible(GoalsPage.updatedValueCss);
};

export const enterUpdatedValueData = async (data) => {
	await clearField(GoalsPage.updatedValueCss);
	await enterInput(GoalsPage.updatedValueCss, data);
};

export const saveDeadlineButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.saveDeadlineButtonCss);
};

export const clickSaveDeadlineButton = async () => {
	await clickButton(GoalsPage.saveDeadlineButtonCss);
};

export const weightTypeButtonVisible = async () => {
	await verifyElementIsVisible(GoalsPage.weightTypeButtonCss);
};

export const clickWeightTypeButton = async (index) => {
	await clickButtonByIndex(GoalsPage.weightTypeButtonCss, index);
};

export const weightParameterDropdownVisible = async () => {
	await verifyElementIsVisible(GoalsPage.weightParameterDropdownCss);
};

export const clickWeightParameterDropdown = async () => {
	await clickButton(GoalsPage.weightParameterDropdownCss);
};

export const selectWeightParameterFromDropdown = async (text) => {
	await clickElementByText(GoalsPage.dropdownOptionCss, text);
};

export const progressBarVisible = async () => {
	await verifyElementIsVisible(GoalsPage.progressBarCss);
};

export const clickProgressBar = async (index) => {
	await clickButtonByIndex(GoalsPage.progressBarCss, index);
};

export const verifyElementIsDeleted = async () => {
	await verifyElementNotExist(GoalsPage.verifyGoalCss);
};

export const verifyGoalExists = async (text) => {
	await verifyText(GoalsPage.verifyGoalCss, text);
};
