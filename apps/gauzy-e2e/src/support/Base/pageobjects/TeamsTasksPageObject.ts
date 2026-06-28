export const TeamsTasksPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar Add lives in #visibleButton (`button[status="success"]`) inside the gauzy-button-action
	// wrapper (`div.actions-container > ... > div.btn-group.actions`). Mirror the proven AddTasks page
	// object: target the bare success button. (Playbook pattern 1.)
	addTaskButtonCss: 'button[status="success"]',
	projectDropdownCss: '[formControlName="projectId"]',
	statusDropdownCss: '[formcontrolname="taskStatus"]',
	teamDropdownCss: '[formcontrolname="teams"]',
	dropdownOptionCss: 'div.ng-option',
	// Edit + Duplicate toolbar buttons BOTH carry `class="action primary"`; a bare nth(0)/nth(1) is
	// ambiguous and brittle across the show/hide transition wrapper (the round-4 cause of a 60s
	// `button.action.primary nth(1)` hang in AddTasks). Disambiguate each by its own nb-icon —
	// edit-outline vs copy-outline — exactly as the proven AddTasksPageObject does. (task.component.html
	// #actionButtons.) clickDuplicateOrEditTaskButton maps index 0 -> edit, 1 -> duplicate.
	editTaskButtonCss: 'button.action.primary:has(nb-icon[icon="edit-outline"])',
	duplicateTaskButtonCss: 'button.action.primary:has(nb-icon[icon="copy-outline"])',
	// Kept for the visibility assertion (either action button present == toolbar rendered with a row selected).
	duplicateOrEditTaskButtonCss: 'button.action.primary',
	// Only an action button matching THIS is "enabled" (Nebular adds .btn-disabled when [disabled] is set,
	// i.e. no row selected) — used to poll that a row-select actually took. (Mirrors AddTasks.)
	enabledActionButtonCss: 'div.actions-container button.action.primary:not(.btn-disabled)',
	// Delete is `class="action"` wrapping an nb-icon[icon="trash-2-outline"]; match it by that icon
	// (mirrors the proven AddTasks deleteTaskButtonCss) rather than the stale actions-container path.
	deleteTaskButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
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
