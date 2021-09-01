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
	verifyTextNotExisting
} from '../utils/util';
import { AddTaskPage } from '../pageobjects/AddTasksPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(AddTaskPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(AddTaskPage.gridButtonCss, index);
};

export const addTaskButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.addTaskButtonCss);
};

export const clickAddTaskButton = () => {
	clickButton(AddTaskPage.addTaskButtonCss);
};

export const selectProjectDropdownVisible = () => {
	verifyElementIsVisible(AddTaskPage.selectProjectDropdownCss);
};

export const clickSelectProjectDropdown = () => {
	clickButton(AddTaskPage.selectProjectDropdownCss);
};

export const selectProjectOptionDropdown = (text) => {
	clickElementByText(AddTaskPage.selectProjectDrodownOptionCss, text);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(AddTaskPage.selectEmloyeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(AddTaskPage.selectEmloyeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = (index) => {
	clickButtonByIndex(AddTaskPage.selectEmployeeDropdownOptionCss, index);
};

export const selectEmployeeFromDropdownByName = (name) => {
	clickElementByText(
		AddTaskPage.selectEmployeeDropdownOptionCss,
		name
	);
};

export const addTitleInputVisible = () => {
	verifyElementIsVisible(AddTaskPage.addTitleInputCss);
};

export const enterTitleInputData = (data) => {
	clearField(AddTaskPage.addTitleInputCss);
	enterInput(AddTaskPage.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(AddTaskPage.tagsSelectCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(AddTaskPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(AddTaskPage.tagsSelectOptionCss, index);
};

export const closeTagsMultiSelectDropdownButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.closeTagsMultiSelectDropdownCss);
};

export const clickCloseTagsMultiSelectDropdownButton = () => {
	clickButton(AddTaskPage.closeTagsMultiSelectDropdownCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const dueDateInputVisible = () => {
	verifyElementIsVisible(AddTaskPage.dueDateInputCss);
};

export const enterDueDateData = () => {
	clearField(AddTaskPage.dueDateInputCss);
	const date = dayjs().add(1, 'd').format('MMM D, YYYY');
	enterInput(AddTaskPage.dueDateInputCss, date);
};

export const estimateDaysInputVisible = () => {
	verifyElementIsVisible(AddTaskPage.estimateDaysInputCss);
};

export const enterEstiamteDaysInputData = (days) => {
	clearField(AddTaskPage.estimateDaysInputCss);
	enterInput(AddTaskPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = () => {
	verifyElementIsVisible(AddTaskPage.estimateHoursInputCss);
};

export const enterEstiamteHoursInputData = (hours) => {
	clearField(AddTaskPage.estimateHoursInputCss);
	enterInput(AddTaskPage.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = () => {
	verifyElementIsVisible(AddTaskPage.estimateMinsInputCss);
};

export const enterEstimateMinutesInputData = (mins) => {
	clearField(AddTaskPage.estimateMinsInputCss);
	enterInput(AddTaskPage.estimateMinsInputCss, mins);
};

export const taskDecriptionTextareaVisible = () => {
	verifyElementIsVisible(AddTaskPage.descriptionTextareaCss);
};

export const enterTaskDescriptionTextareaData = (data) => {
	clearField(AddTaskPage.descriptionTextareaCss);
	enterInput(AddTaskPage.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.saveNewTaskButtonCss);
};

export const clickSaveTaskButton = () => {
	clickButton(AddTaskPage.saveNewTaskButtonCss);
};

export const tasksTableVisible = () => {
	verifyElementIsVisible(AddTaskPage.selectTableRowCss);
};

export const selectTasksTableRow = (index) => {
	clickButtonByIndex(AddTaskPage.selectTableRowCss, index);
};

export const deleteTaskButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.deleteTaskButtonCss);
};

export const clickDeleteTaskButton = () => {
	clickButton(AddTaskPage.deleteTaskButtonCss);
};

export const confirmDeleteTaskButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.confirmDeleteTaskButtonCss);
};

export const clickConfirmDeleteTaskButton = () => {
	clickButton(AddTaskPage.confirmDeleteTaskButtonCss);
};

export const duplicateOrEditTaskButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.duplicateOrEditTaskButtonCss);
};

export const clickDuplicateOrEditTaskButton = (index) => {
	clickButtonByIndex(AddTaskPage.duplicateOrEditTaskButtonCss, index);
};

export const confirmDuplicateOrEditTaskButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmDuplicateOrEditTaskButton = () => {
	clickButton(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(AddTaskPage.toastrMessageCss);
};

export const verifyTaskExists = (text) => {
	verifyText(AddTaskPage.verifyTextCss, text);
};

export const verifyElementIsDeleted = (text) => {
	verifyTextNotExisting(AddTaskPage.verifyTextCss, text);
};
