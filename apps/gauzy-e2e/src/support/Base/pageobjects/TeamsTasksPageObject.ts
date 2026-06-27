export const TeamsTasksPage = {
	gridButtonCss: 'div.layout-switch > button',
	addTaskButtonCss: 'div.actions-container button[status="success"]',
	projectDropdownCss: '[formControlName="projectId"]',
	statusDropdownCss: '[formcontrolname="taskStatus"]',
	teamDropdownCss: '[formcontrolname="teams"]',
	dropdownOptionCss: 'div.ng-option',
	duplicateOrEditTaskButtonCss: 'div.actions-container button.action.primary',
	deleteTaskButtonCss: 'div.actions-container button.action:not(.primary):not(.secondary)',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: '[type="checkbox"]',
	closeTagsMultiSelectDropdownCss: '.ng-select-container > .ng-arrow-wrapper',
	confirmDuplicateOrEditTaskButtonCss: 'nb-card-footer > button[status="success"]',
	confirmDeleteTaskButtonCss: 'nb-card-footer > button[status="danger"]',
	addTitleInputCss: '[formControlName="title"]',
	selectTeamMultiSelectCss: 'nb-select[formcontrolname="teams"] button.select-button',
	selectTeamDropdownOptionCss: '.option-list nb-option',
	dueDateInputCss: '[formControlName="dueDate"]',
	estimateDaysInputCss: '[formControlName="estimateDays"]',
	estimateHoursInputCss: '[formControlName="estimateHours"]',
	estimateMinsInputCss: '[formControlName="estimateMinutes"]',
	descriptionTextareaCss: '[formControlName="description"]',
	saveNewTaskButtonCss: 'nb-card-footer > button[status="success"]',
	// Neutral element inside the task dialog used to dismiss the open tags ng-select panel (closeOnSelect
	// is false). The old 'nb-card-footer.text-right' no longer exists (footer is now .text-left); click the
	// dialog title instead so we don't hit the Save button or a backdrop.
	cardBodyCss: 'nb-card-header h5.title',
	verifyTextCss: 'ga-notes-with-tags > div > div',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
