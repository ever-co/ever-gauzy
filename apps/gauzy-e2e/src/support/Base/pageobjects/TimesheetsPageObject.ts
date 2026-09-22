export const TimesheetsPage = {
	// Toolbar "Add Time" button (daily.component.html visibleButtons template).
	addTimeButtonCss: 'button[status="success"]:has-text("Add Time")',
	// Employee picker is a nb-select (ga-employee-multi-select). Options live in the cdk overlay.
	selectEmployeeCss: 'ga-employee-multi-select[formcontrolname="employeeId"] nb-select',
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	// Date input rendered by ngx-timer-range-picker inside the Add/Edit dialog. Scope to the open
	// nb-card so we never match a date field elsewhere on the page (gauzy-filters, etc.).
	dateInputCss: 'nb-card input[name="date"]',
	// project / client / task / start-time are all ng-select components (open on mousedown, options
	// are appended to body as div.ng-option). They are opened via keyboard in the wrappers, never a
	// force-click (a force-click on the control closes the dialog and is swallowed by the backdrop).
	projectDropdownCss: 'ga-project-selector[formcontrolname="projectId"] ng-select',
	dropdownOptionCss: 'div.ng-option',
	clientDropdownCss: 'ga-contact-selector[formcontrolname="organizationContactId"] ng-select',
	taskDropdownCss: 'ga-task-selector[formcontrolname="taskId"] ng-select',
	descriptionTextareaCss: 'nb-card textarea[name="description"]',
	// Dialog footer Save button ("Add Time"/"Update Time").
	saveTimeButtonCss: 'nb-card-footer button[status="success"]',
	// View / Edit / Delete are now TOOLBAR buttons (daily.component.html actionButtons template),
	// enabled only once a grid row is selected. They live inside ngx-gauzy-button-action.
	viewEmployeeTimeCss: 'ngx-gauzy-button-action button:has(nb-icon[icon="eye-outline"])',
	editEmployeeTimeCss: 'ngx-gauzy-button-action button:has(nb-icon[icon="edit"])',
	deleteEmployeeTimeCss: 'ngx-gauzy-button-action button:has(nb-icon[icon="trash-2-outline"])',
	// Data row in the daily time-log list; clicking it toggles selection (userRowSelect).
	timeLogRowCss: 'nb-card-body .content .row.m-0.py-3',
	// Close ("x") of the view/add dialog header.
	closeAddTimeLogPopoverCss: 'nb-card-header span.cancel i.fas.fa-times',
	// "Yes" button of the ngxConfirmDialog confirm dialog.
	confirmDeleteButtonCss: 'nb-card-footer > button[status="primary"]',
	// start_time is a ga-timer-picker ng-select.
	startTimeDropdownCss: 'ga-timer-picker[name="start_time"] ng-select',
	closeButtonCss: 'button.close-button',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyTimeCss: 'ngx-avatar a.link-text'
};
