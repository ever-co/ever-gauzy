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
} from '../utils/util';
import { TeamsTasksPage } from '../pageobjects/TeamsTasksPageObject';
import { interceptAllApiRequests, waitForAllApiRequests } from '../utils/api-utils';

export const gridBtnExists = () => {
	verifyElementIsVisible(TeamsTasksPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(TeamsTasksPage.gridButtonCss, index);
};

export const addTaskButtonVisible = () => {
	cy.get(TeamsTasksPage.actionsBarCss)
		.findByRole('button', { name: TeamsTasksPage.addButtonName })
		.should('be.visible');
};

export const clickAddTaskButton = () => {
	cy.get(TeamsTasksPage.actionsBarCss)
		.findByRole('button', { name: TeamsTasksPage.addButtonName })
		.click({ force: true });
};

export const selectProjectDropdownVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.projectDropdownCss);
};

export const clickSelectProjectDropdown = () => {
	clickButton(TeamsTasksPage.projectDropdownCss);
};

export const selectProjectOptionDropdown = (text) => {
	clickElementByText(TeamsTasksPage.dropdownOptionCss, text);
};

export const selectStatusDropdownVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.statusDropdownCss);
};

export const clickStatusDropdown = () => {
	clickButton(TeamsTasksPage.statusDropdownCss);
};

export const selectStatusFromDropdown = (text) => {
	clickElementByText(TeamsTasksPage.dropdownOptionCss, text);
};

export const selectTeamDropdownVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.selectTeamMultiSelectCss);
};

export const clickSelectTeamDropdown = () => {
	clickButton(TeamsTasksPage.selectTeamMultiSelectCss);
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

export const tagsMultiSelectVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.tagsSelectCss);
};

export const clickTagsMultiSelect = () => {
	clickButton(TeamsTasksPage.tagsSelectCss);
};

export const selectTagsFromDropdown = (index) => {
	clickButtonByIndex(TeamsTasksPage.tagsSelectOptionCss, index);
};

export const closeTagsMultiSelect = () => {
	clickButton(TeamsTasksPage.tagsSelectArrowCss);
};

export const clickKeyboardButtonByKeyCode = (keycode) => {
	clickKeyboardBtnByKeycode(keycode);
};

export const dueDateInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.dueDateInputCss);
};

export const enterDueDateData = () => {
	clearField(TeamsTasksPage.dueDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	enterInput(TeamsTasksPage.dueDateInputCss, date);
};

export const estimateDaysInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.estimateDaysInputCss);
};

export const enterEstimateDaysInputData = (days) => {
	clearField(TeamsTasksPage.estimateDaysInputCss);
	enterInput(TeamsTasksPage.estimateDaysInputCss, days);
};

export const estimateHoursInputVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.estimateHoursInputCss);
};

export const enterEstimateHoursInputData = (hours) => {
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

export const taskDescriptionTextareaVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.descriptionTextareaCss);
};

export const enterTaskDescriptionTextareaData = (data) => {
	enterInput(TeamsTasksPage.descriptionTextareaCss, data);
};

export const saveTaskButtonVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.saveNewTaskButtonCss);
};

export const clickSaveTaskButton = () => {
	clickButton(TeamsTasksPage.saveNewTaskButtonCss);
};

export const countTasksWithText = (text) => {
	cy.get(TeamsTasksPage.selectTableRowCss)
		.filter(`:contains(${text})`)
		.then((rows) => {
			cy.wrap({ [text]: rows.length }).as('tasksCount');
		});
};

export const tasksTableVisible = () => {
	verifyElementIsVisible(TeamsTasksPage.selectTableRowCss);
};

export const selectTasksTableRow = (index) => {
	clickButtonByIndex(TeamsTasksPage.selectTableRowCss, index);
};

export const selectTaskTableRowByText = (text) => {
	clickElementByText(TeamsTasksPage.selectTableRowCss, text);
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
	cy.get(TeamsTasksPage.actionsBarCss)
		.findByRole('button', { name: TeamsTasksPage.duplicateButtonName })
		.should('be.visible');
};

export const clickDuplicateOrEditTaskButton = (index) => {
	interceptAllApiRequests();
	cy.get(TeamsTasksPage.actionsBarCss)
		.findByRole('button', { name: TeamsTasksPage.duplicateButtonName })
		.click({ force: true });
	waitForAllApiRequests();
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

export const waitMessageToHide = () => {
	waitElementToHide(TeamsTasksPage.toastrMessageCss);
};

export const verifyTaskExists = (text) => {
	verifyText(TeamsTasksPage.verifyTextCss, text);
};

export const verifyTaskIsDeleted = () => {
	verifyElementNotExist(TeamsTasksPage.verifyTextCss);
};

export const verifyOneTaskWasDeleted = (text) => {
	cy.get('@tasksCount').then((count) => {
		cy.document().then((doc) => {
			const rows = doc.querySelectorAll(TeamsTasksPage.selectTableRowCss);
			const filteredRows = Array.from(rows).filter((row) => row.textContent?.includes(text));
			expect(filteredRows.length).to.equal((count as any)[text] - 1);
		});
	});
};
