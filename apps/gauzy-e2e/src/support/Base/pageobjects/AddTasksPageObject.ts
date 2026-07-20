export const AddTaskPage = {
	gridButtonCss: 'div.layout-switch > button',
	addTaskButtonCss: 'button[status="success"]',
	selectProjectDropdownCss: 'ga-project-selector ng-select',
	selectProjectDropdownOptionCss: '.ng-dropdown-panel .ng-option',
	// Edit and Duplicate are BOTH rendered as `button.action.primary` in the tasks toolbar, so a bare
	// index (nth 0/1) is ambiguous and brittle across grid re-renders + the show/hide transition
	// wrapper (the cause of the round-4 `button.action.primary nth(1)` 60s hang). Disambiguate by the
	// button's own nb-icon: edit-outline vs copy-outline. (task.component.html #actionButtons)
	editTaskButtonCss: 'button.action.primary:has(nb-icon[icon="edit-outline"])',
	duplicateTaskButtonCss: 'button.action.primary:has(nb-icon[icon="copy-outline"])',
	// Only an action button matching one of THESE is "enabled" (Nebular adds .btn-disabled when the
	// host [disabled] is set, i.e. no row selected). Used to poll selection state after a row click.
	enabledActionButtonCss: 'div.actions-container button.action.primary:not(.btn-disabled)',
	deleteTaskButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	selectTableFirstRowCss: 'tr.angular2-smart-row.selected',
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: '[type="checkbox"]',
	closeTagsMultiSelectDropdownCss: '.ng-select-container > .ng-arrow-wrapper',
	confirmDuplicateOrEditTaskButtonCss: 'nb-card-footer > button[status="success"]',
	confirmEditTaskButtonCss: '',
	confirmDeleteTaskButtonCss: 'button.mr-3.ml-3',
	addTitleInputCss: '[formControlName="title"]',
	selectEmployeeMultiSelectCss: 'ga-employee-multi-select nb-select button.select-button',
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	dueDateInputCss: '[formControlName="dueDate"]',
	estimateDaysInputCss: '[formControlName="estimateDays"]',
	estimateHoursInputCss: '[formControlName="estimateHours"]',
	estimateMinsInputCss: '[formControlName="estimateMinutes"]',
	descriptionTextareaCss: '[formControlName="description"]',
	saveNewTaskButtonCss: 'nb-card-footer > button[status="success"]',
	verifyTextCss: 'angular2-smart-table table tbody',
	toastrMessageCss: 'nb-toast.ng-trigger',
	searchTitleInputCss: 'input[placeholder="Title"]'
};
