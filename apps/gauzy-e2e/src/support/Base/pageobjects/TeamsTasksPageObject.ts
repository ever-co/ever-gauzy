export const TeamsTasksPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar Add lives in #visibleButton (`button[status="success"]`) and is NOT wrapped by a
	// `div.actions-container` (that wrapper no longer exists; the toolbar is `div.btn-group.actions`).
	// Mirror the proven AddTasks page object: target the bare success button. (Playbook pattern 1.)
	addTaskButtonCss: 'button[status="success"]',
	projectDropdownCss: '[formControlName="projectId"]',
	statusDropdownCss: '[formcontrolname="taskStatus"]',
	teamDropdownCss: '[formcontrolname="teams"]',
	dropdownOptionCss: 'div.ng-option',
	// Edit + Duplicate toolbar buttons both carry `class="action primary"` (no actions-container wrapper).
	// Index 0/1 select between them, same as the proven AddTasks flow. (Playbook pattern 1.)
	duplicateOrEditTaskButtonCss: 'button.action.primary',
	// Delete is `class="action"` wrapping an nb-icon[icon="trash-2-outline"]; match it by that icon
	// (mirrors the proven AddTasks deleteTaskButtonCss) rather than the stale actions-container path.
	deleteTaskButtonCss: 'button:has(nb-icon[icon="trash-2-outline"])',
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
