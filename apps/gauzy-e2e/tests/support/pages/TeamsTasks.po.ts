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
	verifyElementNotExist
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TeamsTasksPage } from '../../../src/support/Base/pageobjects/TeamsTasksPageObject';

export const gridBtnExists = async () => verifyElementIsVisible(TeamsTasksPage.gridButtonCss);

export const gridBtnClick = async (index: number) => clickButtonByIndex(TeamsTasksPage.gridButtonCss, index);

export const addTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.addTaskButtonCss);

export const clickAddTaskButton = async () => clickButton(TeamsTasksPage.addTaskButtonCss);

export const selectProjectDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.projectDropdownCss);

export const clickSelectProjectDropdown = async () => clickButton(TeamsTasksPage.projectDropdownCss);

export const selectProjectOptionDropdown = async (text: string) =>
	clickElementByText(TeamsTasksPage.dropdownOptionCss, text);

export const selectStatusDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.statusDropdownCss);

export const clickStatusDropdown = async () => clickButton(TeamsTasksPage.statusDropdownCss);

export const selectStatusFromDropdown = async (text: string) =>
	clickElementByText(TeamsTasksPage.dropdownOptionCss, text);

export const selectTeamDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.selectTeamMultiSelectCss);

export const clickSelectTeamDropdown = async () => clickButton(TeamsTasksPage.selectTeamMultiSelectCss);

export const selectTeamDropdownOption = async (index: number) =>
	clickButtonByIndex(TeamsTasksPage.selectTeamDropdownOptionCss, index);

export const addTitleInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.addTitleInputCss);

export const enterTitleInputData = async (data: string) => {
	await clearField(TeamsTasksPage.addTitleInputCss);
	await enterInput(TeamsTasksPage.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = async () => verifyElementIsVisible(TeamsTasksPage.tagsSelectCss);

export const clickTagsMultiSelect = async () => clickButton(TeamsTasksPage.tagsSelectCss);

export const selectTagsFromDropdown = async (index: number) =>
	clickButtonByIndex(TeamsTasksPage.tagsSelectOptionCss, index);

export const closeTagsMultiSelectDropdownButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.closeTagsMultiSelectDropdownCss);

export const clickCloseTagsMultiSelectDropdownButton = async () =>
	clickButton(TeamsTasksPage.closeTagsMultiSelectDropdownCss);

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const dueDateInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.dueDateInputCss);

export const enterDueDateData = async () => {
	await clearField(TeamsTasksPage.dueDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(TeamsTasksPage.dueDateInputCss, date);
};

export const estimateDaysInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.estimateDaysInputCss);

export const enterEstimateDaysInputData = async (days: string) => {
	await clearField(TeamsTasksPage.estimateDaysInputCss);
	await enterInput(TeamsTasksPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.estimateHoursInputCss);

export const enterEstimateHoursInputData = async (hours: string) => {
	await clearField(TeamsTasksPage.estimateHoursInputCss);
	await enterInput(TeamsTasksPage.estimateHoursInputCss, hours);
};

export const estimateMinutesInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.estimateMinsInputCss);

export const enterEstimateMinutesInputData = async (mins: string) => {
	await clearField(TeamsTasksPage.estimateMinsInputCss);
	await enterInput(TeamsTasksPage.estimateMinsInputCss, mins);
};

export const taskDescriptionTextareaVisible = async () => verifyElementIsVisible(TeamsTasksPage.descriptionTextareaCss);

export const enterTaskDescriptionTextareaData = async (data: string) => {
	await clearField(TeamsTasksPage.descriptionTextareaCss);
	await enterInput(TeamsTasksPage.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.saveNewTaskButtonCss);

export const clickSaveTaskButton = async () => clickButton(TeamsTasksPage.saveNewTaskButtonCss);

export const tasksTableVisible = async () => verifyElementIsVisible(TeamsTasksPage.selectTableRowCss);

export const selectTasksTableRow = async (index: number) => clickButtonByIndex(TeamsTasksPage.selectTableRowCss, index);

export const deleteTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.deleteTaskButtonCss);

export const clickDeleteTaskButton = async () => clickButton(TeamsTasksPage.deleteTaskButtonCss);

export const confirmDeleteTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.confirmDeleteTaskButtonCss);

export const clickConfirmDeleteTaskButton = async () => clickButton(TeamsTasksPage.confirmDeleteTaskButtonCss);

export const duplicateOrEditTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.duplicateOrEditTaskButtonCss);

export const clickDuplicateOrEditTaskButton = async (index: number) =>
	clickButtonByIndex(TeamsTasksPage.duplicateOrEditTaskButtonCss, index);

export const confirmDuplicateOrEditTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);

export const clickConfirmDuplicateOrEditTaskButton = async () =>
	clickButton(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);

export const clickCardBody = async () => clickButton(TeamsTasksPage.cardBodyCss);

export const waitMessageToHide = async () => waitElementToHide(TeamsTasksPage.toastrMessageCss);

export const verifyTaskExists = async (text: string) => verifyText(TeamsTasksPage.verifyTextCss, text);

export const verifyTaskIsDeleted = async () => verifyElementNotExist(TeamsTasksPage.verifyTextCss);
