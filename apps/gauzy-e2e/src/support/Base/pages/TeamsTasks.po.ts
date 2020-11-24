import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	clickElementByText
} from '../utils/util';
import { TeamsTasksPage } from '../pageobjects/TeamsTasksPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(TeamsTasksPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(TeamsTasksPage.gridButtonCss, index);
};

export const addTaskButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.addTaskButtonCss);
};

export const clickAddTaskButton = () => {
	clickButton(TeamsTasksPage.addTaskButtonCss);
};

export const selectProjectDropdownVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.projectDropdownCss);
};

export const clickSelectProjectDropdown = () => {
	clickButton(TeamsTasksPage.projectDropdownCss);
};

export const selectProjectOptionDropdown = (text) => {
	clickElementByText(TeamsTasksPage.drodownOptionCss, text);
};

export const selectStatusDropdownVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.statusDropdownCss);
};

export const clickStatusDropdown = () => {
	clickButton(TeamsTasksPage.statusDropdownCss);
};

export const selectStatusFromDropdown = (text) => {
	clickElementByText(TeamsTasksPage.drodownOptionCss, text);
};

export const selectTeamDropdownVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.selectTeamMultyselectCss);
};

export const clickSelectTeamDropdown = () => {
	clickButton(TeamsTasksPage.selectTeamMultyselectCss);
};

export const selectTeamDropdownOption = (index) => {
	clickButtonByIndex(TeamsTasksPage.selectTeamDropdownOptionCss, index);
};

export const addTitleInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.addTitleInputCss);
};

export const enterTitleInputData = (data) => {
	clearField(TeamsTasksPage.addTitleInputCss);
	enterInput(TeamsTasksPage.addTitleInputCss, data);
};

export const tagsMultyselectVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.tagsSelectCss);
};

export const clickTagsMultyselect = () => {
	clickButton(TeamsTasksPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(TeamsTasksPage.tagsSelectOptionCss, index);
};

export const closeTagsMultyselectDropdownButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.closeTagsMultyselectDropdownCss);
};

export const clickCloseTagsMultyselectDropdownButton = () => {
	clickButton(TeamsTasksPage.closeTagsMultyselectDropdownCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const dueDateInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.dueDateInputCss);
};

export const enterDueDateData = () => {
	clearField(TeamsTasksPage.dueDateInputCss);
	const date = Cypress.moment().add(1, 'days').format('MMM D, YYYY');
	enterInput(TeamsTasksPage.dueDateInputCss, date);
};

export const estimateDaysInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.estimateDaysInputCss);
};

export const enterEstiamteDaysInputData = (days) => {
	clearField(TeamsTasksPage.estimateDaysInputCss);
	enterInput(TeamsTasksPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.estimateHoursInputCss);
};

export const enterEstiamteHoursInputData = (hours) => {
	clearField(TeamsTasksPage.estimateHoursInputCss);
	enterInput(TeamsTasksPage.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.estimateMinsInputCss);
};

export const enterEstimateMinutesInputData = (mins) => {
	clearField(TeamsTasksPage.estimateMinsInputCss);
	enterInput(TeamsTasksPage.estimateMinsInputCss, mins);
};

export const taskDecriptionTextareaVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.descriptionTextareaCss);
};

export const enterTaskDescriptionTextareaData = (data) => {
	clearField(TeamsTasksPage.descriptionTextareaCss);
	enterInput(TeamsTasksPage.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.saveNewTaskButtonCss);
};

export const clickSaveTaskButton = () => {
	clickButton(TeamsTasksPage.saveNewTaskButtonCss);
};

export const tasksTableVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.selectTableRowCss);
};

export const selectTasksTableRow = (index) => {
	clickButtonByIndex(TeamsTasksPage.selectTableRowCss, index);
};

export const deleteTaskButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.deleteTaskButtonCss);
};

export const clickDeleteTaskButton = () => {
	clickButton(TeamsTasksPage.deleteTaskButtonCss);
};

export const confirmDeleteTaskButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.confirmDeleteTaskButtonCss);
};

export const clickConfirmDeleteTaskButton = () => {
	clickButton(TeamsTasksPage.confirmDeleteTaskButtonCss);
};

export const duplicateOrEditTaskButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.duplicateOrEditTaskButtonCss);
};

export const clickDuplicateOrEditTaskButton = (index) => {
	clickButtonByIndex(TeamsTasksPage.duplicateOrEditTaskButtonCss, index);
};

export const confirmDuplicateOrEditTaskButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmDuplicateOrEditTaskButton = () => {
	clickButton(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickCardBody = () => {
	clickButton(TeamsTasksPage.cardBodyCss);
};
