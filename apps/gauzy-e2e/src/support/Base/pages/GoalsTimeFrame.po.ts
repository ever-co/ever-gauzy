import dayjs from 'dayjs';
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
import { GoalsTimeFramePage } from '../pageobjects/GoalsTimeFramePageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(GoalsTimeFramePage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(GoalsTimeFramePage.gridButtonCss, index);
};

export const tabButtonVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.tabButtonCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(GoalsTimeFramePage.tabButtonCss, index);
};

export const addTimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.addTimeFrameButtonCss);
};

export const clickAddTimeFrameButton = () => {
	clickButton(GoalsTimeFramePage.addTimeFrameButtonCss);
};

export const nameInputVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.titleInputCss);
};

export const enterNameInputData = (data) => {
	clearField(GoalsTimeFramePage.titleInputCss);
	enterInput(GoalsTimeFramePage.titleInputCss, data);
};

export const startDateInputVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.startDateInputCss);
};

export const enterStartDateData = () => {
	clearField(GoalsTimeFramePage.startDateInputCss);
	const date = dayjs().add(1, 'd').format('MMM D, YYYY');
	enterInput(GoalsTimeFramePage.startDateInputCss, date);
};

export const endDateInputVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.startDateInputCss);
};

export const enterEndDateData = () => {
	clearField(GoalsTimeFramePage.endDateInputCss);
	const date = dayjs().add(5, 'd').format('MMM D, YYYY');
	enterInput(GoalsTimeFramePage.endDateInputCss, date);
};

export const saveTimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.saveTimeFrameButtonCss);
};

export const clickSaveTimeFrameButton = () => {
	clickButton(GoalsTimeFramePage.saveTimeFrameButtonCss);
};

export const tableRowVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.selectTableRowCss);
};

export const selectTableRow = (index) => {
	clickButtonByIndex(GoalsTimeFramePage.selectTableRowCss, index);
};

export const editTimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.editButtonCss);
};

export const clickEditTimeFrameButton = () => {
	clickButton(GoalsTimeFramePage.editButtonCss);
};

export const deleteTimeFrameButtonVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.deleteButtonCss);
};

export const clickDeleteTimeFrameButton = () => {
	clickButton(GoalsTimeFramePage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = () => {
	verifyElementIsVisible(GoalsTimeFramePage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = () => {
	clickButton(GoalsTimeFramePage.confirmDeleteButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(GoalsTimeFramePage.toastrMessageCss);
};

export const verifyElementDeleted = (text) => {
	verifyText(GoalsTimeFramePage.verifyEmptyTableCss, text);
};

export const verifyTimeFrameExists = (text) => {
	verifyText(GoalsTimeFramePage.verifyEmptyTableCss, text);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};
