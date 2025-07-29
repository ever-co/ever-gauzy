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
} from '../utils/util';
import { AddTaskPage } from '../pageobjects/AddTasksPageObject';
import { interceptAllApiRequests, waitForAllApiRequests } from '../utils';

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
	clickElementByText(AddTaskPage.selectProjectDropdownOptionCss, text);
};

export const selectEmployeeDropdownVisible = () => {
	verifyElementIsVisible(AddTaskPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = () => {
	clickButton(AddTaskPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = (index) => {
	clickButtonByIndex(AddTaskPage.selectEmployeeDropdownOptionCss, index);
};

export const selectEmployeeFromDropdownByName = (name) => {
	clickElementByText(AddTaskPage.selectEmployeeDropdownOptionCss, name);
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

export const enterEstimateDaysInputData = (days) => {
	clearField(AddTaskPage.estimateDaysInputCss);
	enterInput(AddTaskPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = () => {
	verifyElementIsVisible(AddTaskPage.estimateHoursInputCss);
};

export const enterEstimateHoursInputData = (hours) => {
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

export const taskDescriptionTextareaVisible = () => {
	verifyElementIsVisible(AddTaskPage.descriptionTextareaCss);
};

export const enterTaskDescriptionTextareaData = (data) => {
	enterInput(AddTaskPage.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = () => {
	closeCkeNotification();
	verifyElementIsVisible(AddTaskPage.saveNewTaskButtonCss);
};

export const clickSaveTaskButton = () => {
	closeCkeNotification();
	clickButton(AddTaskPage.saveNewTaskButtonCss);
};

export const countTasksWithText = (text) => {
	cy.get(AddTaskPage.selectTableRowCss)
		.filter(`:contains(${text})`)
		.then((rows) => {
			cy.wrap({ [text]: rows.length }).as('tasksCount');
		});
};

export const tasksTableVisible = () => {
	verifyElementIsVisible(AddTaskPage.selectTableRowCss);
};

export const selectTasksTableRow = (index) => {
	clickButtonByIndex(AddTaskPage.selectTableRowCss, index);
};

export const selectTaskTableRowByText = (text) => {
	clickElementByText(AddTaskPage.selectTableRowCss, text);
};

export const selectFirstTaskTableRow = (index) => {
	clickButtonByIndex(AddTaskPage.selectTableFirstRowCss, index);
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

export const duplicateTaskButtonVisible = () => {
	verifyElementIsVisible(AddTaskPage.duplicateTaskButtonCss);
};

export const clickDuplicateTaskButton = (index) => {
	interceptAllApiRequests();
	clickButton(AddTaskPage.duplicateTaskButtonCss, index);
	waitForAllApiRequests();
};

export const confirmDuplicateTaskButtonVisible = () => {
	closeCkeNotification();
	verifyElementIsVisible(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmDuplicateTaskButton = () => {
	closeCkeNotification();
	clickButton(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const editTaskButtonVisible = () => {
	wait(500);
	verifyElementIsVisible(AddTaskPage.editTaskButtonCss);
};

export const clickEditTaskButton = (index) => {
	clickButtonByIndex(AddTaskPage.editTaskButtonCss, index);
};

export const confirmEditTaskButtonVisible = () => {
	closeCkeNotification();
	verifyElementIsVisible(AddTaskPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickConfirmEditTaskButton = () => {
	closeCkeNotification();
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

export const verifyOneTaskWasDeleted = (text) => {
	cy.get('@tasksCount').then((count) => {
		cy.document().then((doc) => {
			const rows = doc.querySelectorAll(AddTaskPage.selectTableRowCss);
			const filteredRows = Array.from(rows).filter((row) => row.textContent?.includes(text));
			expect(filteredRows.length).to.equal((count as any)[text] - 1);
		});
	});
};

export const verifyTitleInput = () => {
	verifyElementIsVisible(AddTaskPage.searchTitleInputCss);
};

export const searchTitleName = (name: string) => {
	clearField(AddTaskPage.searchTitleInputCss);
	enterInput(AddTaskPage.searchTitleInputCss, name);
};

export const clearSearchInput = () => {
	clearField(AddTaskPage.searchTitleInputCss);
};

export const verifySearchResult = (length: number) => {
	verifyByLength(AddTaskPage.selectTableRowCss, length);
};

// Workaround for cke editor outdated notification, it might be covering the button in some cases
export const closeCkeNotification = () => {
	cy.document().then((doc) => {
		const closeBtn = doc.querySelector('a.cke_notification_close');
		if (closeBtn) {
			cy.wrap(closeBtn).click();
		}
	});
};
