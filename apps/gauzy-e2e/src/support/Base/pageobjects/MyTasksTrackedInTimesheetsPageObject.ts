export const MyTasksTrackedInTimesheets = {
	// The "+ Add" toolbar button on /#/pages/tasks/me is rendered inside ngx-gauzy-button-action via the
	// task.component `actionButtons` template as `button nbButton status="success" (click)="createTaskDialog()"`.
	// The Cypress `div.mb-3 > button[status="success"]` wrapper is gone — scope to the button-action host.
	addButtonCss: 'ngx-gauzy-button-action button[status="success"]',
	// /tasks/me opens MyTaskDialogComponent. Project is a ga-project-selector (ng-select) bound to
	// formControlName="projectId". Target the inner ng-select so the keyboard-open helper can focus its input
	// (ng-select opens on mousedown and a coordinate/force click is backdrop-blocked).
	// Scoped to the dialog: once the employee is a member of a project, the app HEADER renders its own
	// <ga-project-selector> on /pages/tasks/me (header.component.html, showProjectsSelector), and it precedes
	// the dialog in DOM order. MyTaskDialogComponent does NOT follow the header's project, so driving the
	// header one left the new task without a project.
	projectDropdownCss: 'ngx-my-task-dialog ga-project-selector ng-select',
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
	// Neutral spot inside the dialog — clicking it dismisses an open ng-select panel (outside click) before
	// moving on. The dialog title, not the body: a click at the CENTRE of nb-card-body.body lands on whichever
	// form control sits there (a priority/size ng-select would open instead). Mirrors TeamsTasksPage.cardBodyCss.
	cardBodyCss: 'ngx-my-task-dialog nb-card-header h5.title',
	dueDateInputCss: '[formControlName="dueDate"]',
	estimateDaysInputCss: '[formControlName="estimateDays"]',
	estimateHoursInputCss: '[formControlName="estimateHours"]',
	estimateMinsInputCss: '[formControlName="estimateMinutes"]',
	// Description is the shared rich-text editor (<ga-rich-text-editor formControlName="description">) whose
	// editable is a plain contenteditable div (.ProseMirror) in the MAIN frame — the host is NOT fillable.
	// Assert on the host; fill the .ProseMirror editable (see .po).
	descriptionTextareaCss: '[formControlName="description"]',
	richTextEditorCss: 'ga-rich-text-editor .ProseMirror',
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
	// Scoped to the timer window host (<ngx-web-time-tracker>, time-tracker.component.ts) so a task dialog's
	// "Parent task" ga-task-selector can never match first.
	taskSelectCss: 'ngx-web-time-tracker ga-task-selector ng-select',
	// Start/Stop is ONE toggle button whose [status] flips success->danger. div.actions div.toggle scopes it
	// to the timer widget (the view-log block also has a status="success" START button, avoided here).
	// Both use the CLASS form: time-tracker.component.html property-binds [status]="running ? 'danger' :
	// 'success'", and a property binding is never written to the DOM as an attribute — Nebular only
	// reflects it as the class status-danger / status-success. `button[status="danger"]` matched nothing.
	startTimerBtnCss: 'div.actions div.toggle button.status-success',
	stopTimerBtnCss: 'div.actions div.toggle button.status-danger',
	// The "View Timesheet" anchor uses [routerLink]="['/pages/employees/timesheets']", which the hash-router
	// renders as href="#/pages/employees/timesheets".
	viewTimesheetBtnCss: 'div.view-log-button a[href="#/pages/employees/timesheets"]',
	// After navigating to the timesheet (daily view), each log row shows the task title under
	// div.col-3 > div.mt-2.small > span ("To-do: <title>"). Title is truncated to 40 chars in the view.
	projectNameCss: 'div.mt-2.small'
};
