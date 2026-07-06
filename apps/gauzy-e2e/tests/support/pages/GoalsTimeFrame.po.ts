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
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { GoalsTimeFramePage } from '../../../src/support/Base/pageobjects/GoalsTimeFramePageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const tabButtonVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.tabButtonCss);
};

export const clickTabButton = async (index) => {
	await clickButtonByIndex(GoalsTimeFramePage.tabButtonCss, index);
};

export const addTimeFrameButtonVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.addTimeFrameButtonCss);
};

export const clickAddTimeFrameButton = async () => {
	await clickButton(GoalsTimeFramePage.addTimeFrameButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.titleInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(GoalsTimeFramePage.titleInputCss);
	await enterInput(GoalsTimeFramePage.titleInputCss, data);
};

export const startDateInputVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.startDateInputCss);
};

export const enterStartDateData = async () => {
	await clearField(GoalsTimeFramePage.startDateInputCss);
	const date = dayjs().add(1, 'd').format('MMM D, YYYY');
	await enterInput(GoalsTimeFramePage.startDateInputCss, date);
};

export const endDateInputVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.startDateInputCss);
};

export const enterEndDateData = async () => {
	await clearField(GoalsTimeFramePage.endDateInputCss);
	const date = dayjs().add(5, 'd').format('MMM D, YYYY');
	await enterInput(GoalsTimeFramePage.endDateInputCss, date);
};

export const saveTimeFrameButtonVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.saveTimeFrameButtonCss);
};

export const clickSaveTimeFrameButton = async () => {
	await clickButton(GoalsTimeFramePage.saveTimeFrameButtonCss);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	await clickButtonByIndex(GoalsTimeFramePage.selectTableRowCss, index);
};

export const editTimeFrameButtonVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.editButtonCss);
};

export const clickEditTimeFrameButton = async () => {
	await clickButton(GoalsTimeFramePage.editButtonCss);
};

export const deleteTimeFrameButtonVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.deleteButtonCss);
};

export const clickDeleteTimeFrameButton = async () => {
	await clickButton(GoalsTimeFramePage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(GoalsTimeFramePage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	await clickButton(GoalsTimeFramePage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(GoalsTimeFramePage.toastrMessageCss);
};

export const verifyElementDeleted = async (text) => {
	await verifyText(GoalsTimeFramePage.verifyEmptyTableCss, text);
};

export const verifyTimeFrameExists = async (text) => {
	await verifyText(GoalsTimeFramePage.verifyEmptyTableCss, text);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};
