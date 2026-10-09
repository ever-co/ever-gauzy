import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	clickByText,
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

// Select the row for a specific time frame instead of a positional index. The organization can hold
// time frames this spec did not create — the goals spec has to create one (the objective form's
// deadline is required and the database seeds no time frames), and it survives the run — so a blind
// row 0 would edit and then DELETE somebody else's frame.
export const selectTableRowByName = async (name: string) => {
	await clickByText(GoalsTimeFramePage.selectTableRowCss, name);
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

// Assert THIS spec's time frame is gone, rather than that the whole grid is empty. "No data found"
// only ever held because nothing else created a time frame; the goals spec now has to create one (the
// objective form's deadline is required and the database seeds none), so an empty-table assertion
// fails on a row that is not ours and was never part of what this spec exercises.
export const verifyTimeFrameIsDeleted = async (name: string) => {
	// Scope to grid ROWS: verifyTimeFrameCss ('div.ng-star-inserted') also matches the row's ancestor
	// wrappers, so a hasText filter resolves to six nested elements for a single row.
	await verifyTextNotExisting(GoalsTimeFramePage.selectTableRowCss, name);
};

export const verifyTimeFrameExists = async (text) => {
	await verifyText(GoalsTimeFramePage.verifyEmptyTableCss, text);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};
