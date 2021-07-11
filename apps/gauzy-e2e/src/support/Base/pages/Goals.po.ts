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
} from '../utils/util';
import { GoalsPage } from '../pageobjects/GoalsPageObject';

export const addButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.addButtonCss);
};

export const clickAddButton = (index) => {
	clickButtonByIndex(GoalsPage.addButtonCss, index);
};

export const selectOptionFromDropdown = (index) => {
	clickButtonByIndex(GoalsPage.optionDropdownCss, index);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(GoalsPage.nameInputCss);
};

export const enterNameInputData = (data) => {
	clearField(GoalsPage.nameInputCss);
	enterInput(GoalsPage.nameInputCss, data);
};

export const ownerDropdownVisible = () => {
	verifyElementIsVisible(GoalsPage.ownerDropdownCss);
};

export const clickOwnerDropdown = () => {
	clickButton(GoalsPage.ownerDropdownCss);
};

export const selectOwnerFromDropdown = (text) => {
	clickElementByText(GoalsPage.dropdownOptionCss, text);
};

export const leadDropdownVisible = () => {
	verifyElementIsVisible(GoalsPage.leadDropdownCss);
};

export const clickLeadDropdown = () => {
	clickButton(GoalsPage.leadDropdownCss);
};

export const selectLeadFromDropdown = (index) => {
	clickButtonByIndex(GoalsPage.dropdownOptionCss, index);
};

export const confirmButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.confirmButtonCss);
};

export const editButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.editButtonCss);
};

export const clickEditButton = (index) => {
	clickButtonByIndex(GoalsPage.editButtonCss, index);
};

export const viewButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.viewButtonCss);
};

export const clickViewButton = (index) => {
	clickButtonByIndex(GoalsPage.viewButtonCss, index);
};

export const deleteButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.deleteButtonCss);
};

export const clickDeleteButton = () => {
	clickButton(GoalsPage.deleteButtonCss);
};

export const clickConfirmButton = () => {
	clickButton(GoalsPage.confirmButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(GoalsPage.toastrMessageCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(GoalsPage.tableRowCss);
};

export const clickTableRow = (index) => {
	waitUntil(3000);
	clickButtonByIndex(GoalsPage.tableRowCss, index);
};

export const keyResultInputVisible = () => {
	verifyElementIsVisible(GoalsPage.keyResultInputCss);
};

export const enterKeyResultNameData = (data) => {
	clearField(GoalsPage.keyResultInputCss);
	enterInput(GoalsPage.keyResultInputCss, data);
};

export const initialValueInputVisible = () => {
	verifyElementIsVisible(GoalsPage.initialValueCss);
};

export const enterInitialValueData = (data) => {
	clearField(GoalsPage.initialValueCss);
	enterInput(GoalsPage.initialValueCss, data);
};

export const targetValueInputVisible = () => {
	verifyElementIsVisible(GoalsPage.targetValueCss);
};

export const enterTargetValueData = (data) => {
	clearField(GoalsPage.targetValueCss);
	enterInput(GoalsPage.targetValueCss, data);
};

export const keyResultOwnerDropdownVisible = () => {
	verifyElementIsVisible(GoalsPage.keyResultOwnerCss);
};

export const clickKeyResultOwnerDropdown = () => {
	clickButton(GoalsPage.keyResultOwnerCss);
};

export const selectKeyResultOwnerFromDropdown = (index) => {
	clickButtonByIndex(GoalsPage.dropdownOptionCss, index);
};

export const keyResultLeadDropdownVisible = () => {
	verifyElementIsVisible(GoalsPage.keyResultLeadCss);
};

export const clickKeyResultLeadDropdown = () => {
	clickButton(GoalsPage.keyResultLeadCss);
};

export const selectKeyResultLeadFromDropdown = (index) => {
	clickButtonByIndex(GoalsPage.dropdownOptionCss, index);
};

export const toggleButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.toggleButtonCss);
};

export const clickToggleButton = () => {
	clickButton(GoalsPage.toggleButtonCss);
};

export const addNewDeadlineButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.addDeadlineButtonCss);
};

export const clickAddDeadlineButton = () => {
	clickButton(GoalsPage.addDeadlineButtonCss);
};

export const updatedValueInputVisible = () => {
	verifyElementIsVisible(GoalsPage.updatedValueCss);
};

export const enterUpdatedValueData = (data) => {
	clearField(GoalsPage.updatedValueCss);
	enterInput(GoalsPage.updatedValueCss, data);
};

export const saveDeadlineButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.saveDeadlineButtonCss);
};

export const clickSaveDeadlineButton = () => {
	clickButton(GoalsPage.saveDeadlineButtonCss);
};

export const weightTypeButtonVisible = () => {
	verifyElementIsVisible(GoalsPage.weightTypeButtonCss);
};

export const clickWeightTypeButton = (index) => {
	clickButtonByIndex(GoalsPage.weightTypeButtonCss, index);
};

export const weightParameterDropdwonVisible = () => {
	verifyElementIsVisible(GoalsPage.weightParameterDropdownCss);
};

export const clickWeightParameterDropdown = () => {
	clickButton(GoalsPage.weightParameterDropdownCss);
};

export const selectWeightParameterFromDropdown = (text) => {
	clickElementByText(GoalsPage.dropdownOptionCss, text);
};

export const progressBarVisible = () => {
	verifyElementIsVisible(GoalsPage.progressBarCss);
};

export const clickProgressBar = (index) => {
	clickButtonByIndex(GoalsPage.progressBarCss, index);
};

export const verifyElementIsDeleted = () => {
	verifyElementNotExist(GoalsPage.verifyGoalCss);
};

export const verifyGoalExists = (text) => {
	verifyText(GoalsPage.verifyGoalCss, text);
};
