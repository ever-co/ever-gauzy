import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	clickKeyboardBtnByKeycode
} from '../utils/util';
import { GoalstimeFramePage } from '../pageobjects/GoalsTimeFramePageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(GoalstimeFramePage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(GoalstimeFramePage.gridButtonCss, index);
};

export const tabButtonVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.tabButtonCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(GoalstimeFramePage.tabButtonCss, index);
};

export const addtimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.addTimeFrameButtonCss);
};

export const clickAddtimeFrameButton = () => {
	clickButton(GoalstimeFramePage.addTimeFrameButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.titleInputCss);
};

export const enterNameInputData = (data) => {
	clearField(GoalstimeFramePage.titleInputCss);
	enterInput(GoalstimeFramePage.titleInputCss, data);
};

export const startDateInputVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.startDateInputCss);
};

export const enterStartDateData = () => {
	clearField(GoalstimeFramePage.startDateInputCss);
	const date = Cypress.moment().add(1, 'days').format('MMM D, YYYY');
	enterInput(GoalstimeFramePage.startDateInputCss, date);
};

export const endDateInputVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.startDateInputCss);
};

export const enterEndDateData = () => {
	clearField(GoalstimeFramePage.endDateInputCss);
	const date = Cypress.moment().add(5, 'days').format('MMM D, YYYY');
	enterInput(GoalstimeFramePage.endDateInputCss, date);
};

export const saveTimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.saveTimeFrameButtonCss);
};

export const clickSaveTimeFrameButton = () => {
	clickButton(GoalstimeFramePage.saveTimeFrameButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(GoalstimeFramePage.selectTableRowCss, index);
};

export const editTimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.editButtonCss);
};

export const clickEditTimeFrameButton = () => {
	clickButton(GoalstimeFramePage.editButtonCss);
};

export const deleteTimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.deleteButtonCss);
};

export const clickDeleteTimeFrameButton = () => {
	clickButton(GoalstimeFramePage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(GoalstimeFramePage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(GoalstimeFramePage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(GoalstimeFramePage.toastrMessageCss);
};

export const verifyElementDeleted = (text) => {
	verifyText(GoalstimeFramePage.verifyEmpytTableCss, text);
};

export const verifyTimeFrameExists = (text) => {
	verifyText(GoalstimeFramePage.verifyEmpytTableCss, text);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};
