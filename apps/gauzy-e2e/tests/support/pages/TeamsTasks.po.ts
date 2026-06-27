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
	verifyElementNotExist,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TeamsTasksPage } from '../../../src/support/Base/pageobjects/TeamsTasksPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.addTaskButtonCss);

export const clickAddTaskButton = async () => clickButton(TeamsTasksPage.addTaskButtonCss);

export const selectProjectDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.projectDropdownCss);

export const clickSelectProjectDropdown = async () => {
	// ga-project-selector is an ng-select (appendTo body) — it opens on MOUSEDOWN and a coordinate/force
	// click is backdrop-blocked by a fading nb-dialog overlay and can even CLOSE the add-task dialog.
	// Open it with the keyboard instead — focus the inner input and press ArrowDown. (Playbook pattern 3.)
	const input = getPage().locator(TeamsTasksPage.projectDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectProjectOptionDropdown = async (text: string) =>
	clickElementByText(TeamsTasksPage.dropdownOptionCss, text);

export const selectStatusDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.statusDropdownCss);

export const clickStatusDropdown = async () => {
	// ga-task-status-select is also an ng-select (appendTo body) — open via keyboard, same as project. (Pattern 3.)
	const input = getPage().locator(TeamsTasksPage.statusDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectStatusFromDropdown = async (text: string) =>
	clickElementByText(TeamsTasksPage.dropdownOptionCss, text);

export const selectTeamDropdownVisible = async () => verifyElementIsVisible(TeamsTasksPage.selectTeamMultiSelectCss);

export const clickSelectTeamDropdown = async () => {
	// Teams is a Nebular nb-select (opens on click, options are '.option-list nb-option'); settle any
	// transient form spinner first so the panel renders before selectTeamDropdownOption polls for options.
	await waitForSpinnerGone();
	await clickButton(TeamsTasksPage.selectTeamMultiSelectCss);
};

export const selectTeamDropdownOption = async (index: number) =>
	clickButtonByIndex(TeamsTasksPage.selectTeamDropdownOptionCss, index);

export const addTitleInputVisible = async () => verifyElementIsVisible(TeamsTasksPage.addTitleInputCss);

export const enterTitleInputData = async (data: string) => {
	await clearField(TeamsTasksPage.addTitleInputCss);
	await enterInput(TeamsTasksPage.addTitleInputCss, data);
};

export const tagsMultiSelectVisible = async () => verifyElementIsVisible(TeamsTasksPage.tagsSelectCss);

export const clickTagsMultiSelect = async () => {
	// Tags is an ng-select (#addTags, appendTo body) — it opens on MOUSEDOWN and a force-click lands on the
	// dialog backdrop or closes the add form. Open it via keyboard (focus inner input + ArrowDown). (Pattern 3.)
	const input = getPage().locator(TeamsTasksPage.tagsSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagsFromDropdown = async (index: number) =>
	// Each ng-option for a multi-select tag renders a checkbox; pick by index. (Options are in the
	// appended .ng-dropdown-panel, so this matches the option's checkbox regardless of the backdrop.)
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

export const clickSaveTaskButton = async () => {
	// Save sits in the dialog footer right after the whole form was filled; a coordinate click can land on
	// a lingering cdk-overlay backdrop (from the just-closed ng-select panels). Settle any spinner, then
	// dispatch the click straight to the element so the (click) handler fires through the overlay. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.saveNewTaskButtonCss);
};

export const tasksTableVisible = async () => verifyElementIsVisible(TeamsTasksPage.selectTableRowCss);

export const selectTasksTableRow = async (index: number) => {
	// Row click TOGGLES selection (it enables the toolbar Edit/Duplicate/Delete). Let the grid finish
	// loading/re-rendering after the preceding save/delete before clicking, otherwise the click can toggle
	// a row that's about to be replaced. Settle, then click once. (Playbook pattern 4.)
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => undefined);
	await getPage().waitForTimeout(1500);
	await clickButtonByIndex(TeamsTasksPage.selectTableRowCss, index);
};

export const deleteTaskButtonVisible = async () => verifyElementIsVisible(TeamsTasksPage.deleteTaskButtonCss);

export const clickDeleteTaskButton = async () => clickButton(TeamsTasksPage.deleteTaskButtonCss);

export const confirmDeleteTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.confirmDeleteTaskButtonCss);

export const clickConfirmDeleteTaskButton = async () => {
	// Confirm sits in the delete-confirmation dialog footer; dispatch through any fading backdrop. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.confirmDeleteTaskButtonCss);
};

export const duplicateOrEditTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.duplicateOrEditTaskButtonCss);

export const clickDuplicateOrEditTaskButton = async (index: number) =>
	clickButtonByIndex(TeamsTasksPage.duplicateOrEditTaskButtonCss, index);

export const confirmDuplicateOrEditTaskButtonVisible = async () =>
	verifyElementIsVisible(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);

export const clickConfirmDuplicateOrEditTaskButton = async () => {
	// Confirm/Save sits in the freshly-opened task dialog footer; dispatch through any fading backdrop. (Pattern 2.)
	await waitForSpinnerGone();
	await dispatchClick(TeamsTasksPage.confirmDuplicateOrEditTaskButtonCss);
};

export const clickCardBody = async () => clickButton(TeamsTasksPage.cardBodyCss);

export const waitMessageToHide = async () => waitElementToHide(TeamsTasksPage.toastrMessageCss);

export const verifyTaskExists = async (text: string) => verifyText(TeamsTasksPage.verifyTextCss, text);

export const verifyTaskIsDeleted = async () => verifyElementNotExist(TeamsTasksPage.verifyTextCss);
