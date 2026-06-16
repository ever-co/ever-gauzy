import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	verifyByLength,
	wait
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddTaskPage } from '../../../src/support/Base/pageobjects/AddTasksPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.addTaskButtonCss);
};

export const clickAddTaskButton = async () => {
	await clickButton(AddTaskPage.addTaskButtonCss);
};

export const selectProjectDropdownVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.selectProjectDropdownCss);
};

export const clickSelectProjectDropdown = async () => {
	await clickButton(AddTaskPage.selectProjectDropdownCss);
};

export const selectProjectOptionDropdown = async (text) => {
	await clickElementByText(AddTaskPage.selectProjectDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	await clickButton(AddTaskPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	await clickButtonByIndex(AddTaskPage.selectEmployeeDropdownOptionCss, index);
};

export const selectEmployeeFromDropdownByName = async (name) => {
	await clickElementByText(AddTaskPage.selectEmployeeDropdownOptionCss, name);
};

export const addTitleInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.addTitleInputCss);
};

export const enterTitleInputData = async (data) => {
	await clearField(AddTaskPage.addTitleInputCss);
	await enterInput(AddTaskPage.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(AddTaskPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index) => {
	await clickButtonByIndex(AddTaskPage.tagsSelectOptionCss, index);
};

export const closeTagsMultiSelectDropdownButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.closeTagsMultiSelectDropdownCss);
};

export const clickCloseTagsMultiSelectDropdownButton = async () => {
	await clickButton(AddTaskPage.closeTagsMultiSelectDropdownCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const dueDateInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.dueDateInputCss);
};

export const enterDueDateData = async () => {
	await clearField(AddTaskPage.dueDateInputCss);
	const date = dayjs().add(1, 'd').format('MMM D, YYYY');
	await enterInput(AddTaskPage.dueDateInputCss, date);
};

export const estimateDaysInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.estimateDaysInputCss);
};

export const enterEstimateDaysInputData = async (days) => {
	await clearField(AddTaskPage.estimateDaysInputCss);
	await enterInput(AddTaskPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.estimateHoursInputCss);
};

export const enterEstimateHoursInputData = async (hours) => {
	await clearField(AddTaskPage.estimateHoursInputCss);
	await enterInput(AddTaskPage.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.estimateMinsInputCss);
};

export const enterEstimateMinutesInputData = async (mins) => {
	await clearField(AddTaskPage.estimateMinsInputCss);
	await enterInput(AddTaskPage.estimateMinsInputCss, mins);
};

export const taskDescriptionTextareaVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.descriptionTextareaCss);
};

export const enterTaskDescriptionTextareaData = async (data) => {
	await clearField(AddTaskPage.descriptionTextareaCss);
	await enterInput(AddTaskPage.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.saveNewTaskButtonCss);
};

export const clickSaveTaskButton = async () => {
	await clickButton(AddTaskPage.saveNewTaskButtonCss);
};

export const tasksTableVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.selectTableRowCss);
};

export const selectTasksTableRow = async (index) => {
	await clickButtonByIndex(AddTaskPage.selectTableRowCss, index);
};

export const selectFirstTaskTableRow = async (index) => {
	await clickButtonByIndex(AddTaskPage.selectTableFirstRowCss, index);
};

export const deleteTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.deleteTaskButtonCss);
};

export const clickDeleteTaskButton = async () => {
	await clickButton(AddTaskPage.deleteTaskButtonCss);
};

export const confirmDeleteTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.confirmDeleteTaskButtonCss);
};

export const clickConfirmDeleteTaskButton = async () => {
	await clickButton(AddTaskPage.confirmDeleteTaskButtonCss);
};

export const duplicateTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.duplicateTaskButtonCss);
};

export const clickDuplicateTaskButton = async (index) => {
	await clickButtonByIndex(AddTaskPage.duplicateTaskButtonCss, index);
};

export const confirmDuplicateTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmDuplicateTaskButton = async () => {
	await clickButton(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const editTaskButtonVisible = async () => {
	await wait(500);
	await verifyElementIsVisible(AddTaskPage.editTaskButtonCss);
};

export const clickEditTaskButton = async (index) => {
	await clickButtonByIndex(AddTaskPage.editTaskButtonCss, index);
};

export const confirmEditTaskButtonVisible = async () => {
	await verifyElementIsVisible(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmEditTaskButton = async () => {
	await clickButton(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddTaskPage.toastrMessageCss);
};

export const verifyTaskExists = async (text) => {
	await verifyText(AddTaskPage.verifyTextCss, text);
};

export const verifyElementIsDeleted = async (text) => {
	await verifyTextNotExisting(AddTaskPage.verifyTextCss, text);
};

export const verifyTitleInput = async () => {
	await verifyElementIsVisible(AddTaskPage.searchTitleInputCss);
};

export const searchTitleName = async (name: string) => {
	await clearField(AddTaskPage.searchTitleInputCss);
	await enterInput(AddTaskPage.searchTitleInputCss, name);
};

export const clearSearchInput = async () => {
	await clearField(AddTaskPage.searchTitleInputCss);
};

export const verifySearchResult = async (length: number) => {
	await verifyByLength(AddTaskPage.selectTableRowCss, length);
};
