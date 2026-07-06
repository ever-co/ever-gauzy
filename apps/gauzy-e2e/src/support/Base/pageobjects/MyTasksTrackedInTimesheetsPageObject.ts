export const MyTasksTrackedInTimesheets = {
	// The "+ Add" toolbar button on /#/pages/tasks/me is rendered inside ngx-gauzy-button-action via the
	// task.component `actionButtons` template as `button nbButton status="success" (click)="createTaskDialog()"`.
	// The Cypress `div.mb-3 > button[status="success"]` wrapper is gone — scope to the button-action host.
	addButtonCss: 'ngx-gauzy-button-action button[status="success"]',
	// /tasks/me opens MyTaskDialogComponent. Project is a ga-project-selector (ng-select) bound to
	// formControlName="projectId". Target the inner ng-select so the keyboard-open helper can focus its input
	// (ng-select opens on mousedown and a coordinate/force click is backdrop-blocked).
	projectDropdownCss: 'ga-project-selector ng-select',
	// Options for every ng-select render in a body-level `.ng-dropdown-panel` (appendTo="body" on the status
	// select; the project/tags panels are `.ng-dropdown-panel` too). `.ng-option` is the option row for all.
	dropdownOptionCss: '.ng-dropdown-panel .ng-option',
	// Status moved from a bare [formcontrolname="status"] to <ga-task-status-select formControlName="taskStatus">,
	// whose inner control is an ng-select (appendTo="body"). Open via keyboard; options are `.ng-option`.
	statusDropdownCss: 'ga-task-status-select ng-select',
	addTitleInputCss: '[formControlName="title"]',
	// Tags: <ga-tags-color-input> still renders an ng-select with id="addTags" (an ng-select, NOT the old
	// checkbox multiselect). Open via keyboard; options are `.ng-option` in the body panel.
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: '.ng-dropdown-panel .ng-option',
	// Dialog body host — clicking it dismisses an open ng-select panel before moving on.
	cardBodyCss: 'nb-card-body.body',
	dueDateInputCss: '[formControlName="dueDate"]',
	estimateDaysInputCss: '[formControlName="estimateDays"]',
	estimateHoursInputCss: '[formControlName="estimateHours"]',
	estimateMinsInputCss: '[formControlName="estimateMinutes"]',
	// Description is a CKEditor 4 widget (<ckeditor formControlName="description">) whose editable lives in a
	// wysiwyg iframe — the host is NOT fillable. Assert on the host; type into the iframe body (see .po).
	descriptionTextareaCss: '[formControlName="description"]',
	ckeditorIframeCss: 'iframe[class="cke_wysiwyg_frame cke_reset"]',
	// Dialog footer Save (nb-card-footer button[status="success"]). Gated on form validity + employeeId,
	// which is populated because we run this logged in AS the employee.
	saveNewTaskButtonCss: 'nb-card-footer button[status="success"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// Header timer widget trigger (header.component.html): <nb-action class="timer-action" ...>.
	timerCss: 'nb-action.timer-action',
	// The clock icon inside the timer action — confirms the header timer control rendered.
	timerBtnCss: 'nb-action.timer-action nb-icon[icon="clock-outline"]',
	// Task select inside the timer window is <ga-task-selector> (an ng-select). The Cypress
	// ng-reflect-placeholder attribute selector is stale/prod-stripped — target the component's ng-select.
	taskSelectCss: 'ga-task-selector ng-select',
	// Start/Stop is ONE toggle button whose [status] flips success->danger. div.actions div.toggle scopes it
	// to the timer widget (the view-log block also has a status="success" START button, avoided here).
	startTimerBtnCss: 'div.actions div.toggle button.status-success',
	stopTimerBtnCss: 'div.actions div.toggle button[status="danger"]',
	// The "View Timesheet" anchor uses [routerLink]="['/pages/employees/timesheets']", which the hash-router
	// renders as href="#/pages/employees/timesheets".
	viewTimesheetBtnCss: 'div.view-log-button a[href="#/pages/employees/timesheets"]',
	// After navigating to the timesheet (daily view), each log row shows the task title under
	// div.col-3 > div.mt-2.small > span ("To-do: <title>"). Title is truncated to 40 chars in the view.
	projectNameCss: 'div.mt-2.small'
};
