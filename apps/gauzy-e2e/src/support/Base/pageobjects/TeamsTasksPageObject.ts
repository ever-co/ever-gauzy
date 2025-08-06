const ACTIONS_BAR_CSS = '.actions-container';
const CONDITIONAL_ACTIONS_CSS = `${ACTIONS_BAR_CSS} .actions.ng-star-inserted`;

export const TeamsTasksPage = {
	gridButtonCss: 'div.layout-switch > button',
	addTaskButtonCss: 'div.mb-3 > button[status="success"]',
	projectDropdownCss: '[formControlName="projectId"] .ng-input input',
	statusDropdownCss: '[formcontrolname="taskStatus"] .ng-input input',
	teamDropdownCss: '[formcontrolname="teams"]',
	dropdownOptionCss: 'div.ng-option',
	duplicateOrEditTaskButtonCss: 'div.mb-3 > button[status="info"]',
	deleteTaskButtonCss: `${CONDITIONAL_ACTIONS_CSS} button:last-of-type`,
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	tagsSelectCss: 'nb-dialog-container #addTags .ng-input input',
	tagsSelectArrowCss: 'nb-dialog-container #addTags .ng-arrow-wrapper',
	tagsSelectOptionCss: '.ng-dropdown-panel [type="checkbox"]',
	closeTagsMultiSelectDropdownCss: '.ng-select-container > .ng-arrow-wrapper',
	confirmDuplicateOrEditTaskButtonCss: 'nb-card-footer > button[status="success"]',
	confirmDeleteTaskButtonCss: 'nb-card-footer > button[status="danger"]',
	addTitleInputCss: '[formControlName="title"]',
	selectTeamMultiSelectCss: '[formcontrolname="teams"] button',
	selectTeamDropdownOptionCss: '.option-list nb-option',
	dueDateInputCss: '[formControlName="dueDate"]',
	estimateDaysInputCss: '[formControlName="estimateDays"]',
	estimateHoursInputCss: '[formControlName="estimateHours"]',
	estimateMinsInputCss: '[formControlName="estimateMinutes"]',
	descriptionTextareaCss: '[formControlName="description"]',
	saveNewTaskButtonCss: 'nb-card-footer > button[status="success"]',
	cardBodyCss: 'nb-card-footer.text-right',
	verifyTextCss: 'ga-notes-with-tags > div > div.ng-star-inserted',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// testing library
	actionsBarCss: ACTIONS_BAR_CSS,
	addButtonName: 'Add',
	duplicateButtonName: 'Duplicate'
};
