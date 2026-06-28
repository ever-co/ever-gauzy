export const TimeOffPage = {
	// Scope the Request "Add" to the time-off-only calendar icon. The bare
	// 'div.actions-container button[status="success"]' ALSO matches the employees-page "Add" button
	// (same gauzy-button-action markup). When the goto() to time-off is a same-document hash no-op (the
	// employees grid is still mounted for a beat after addEmployee), the bare selector matched the
	// employees Add and re-opened the Add Employee dialog, whose backdrop then blocked the request
	// dialog from ever rendering (the round-3 failure). The calendar-outline icon is unique to time-off.
	requestButtonCss: 'div.actions-container button[status="success"]:has(nb-icon[icon="calendar-outline"])',
	// Time-off-only header marker used to confirm the SPA actually rendered the time-off screen before
	// we interact (the employees toolbar has no "Add Holidays" info button / calendar Add).
	timeOffPageReadyCss: 'div.actions-container button.action.info:has(nb-icon[icon="plus-outline"])',
	employeeDropdownCss: 'ngx-time-off-request-mutation ga-employee-selector.employees',
	employeeDropdownOptionCss: 'div.ng-option[role="option"]',
	timeOffPolicyDropdownCss: 'nb-select[id="policy"]',
	timeOffPolicyDropdownOptionCss: '.option-list nb-option',
	startDateInputCss: '[formControlName="start"]',
	endDateInputCss: '[formControlName="end"]',
	descriptionInputCss: '[formControlName="description"]',
	saveRequestButtonCss: 'nb-card-footer > button[status="success"]',
	addHolidayButtonCss: 'div.actions-container button.action.info',
	selectHolidayDropdownOptionCss: '.option-list nb-option',
	selectEmployeeCss: 'nb-select:has-text("Add or Remove Employees")',
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	startHolidayDateCss: '[formControlName="start"]',
	endHolidayDateCss: '[formControlName="end"]',
	saveButtonCss: 'nb-card-footer > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	deleteTimeOfRequestButtonCss: 'div.btn-group.actions button:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteTimeOfButtonCss: 'nb-card-footer > button[status="danger"]',
	editTimeOfRequestButtonCss: 'div.btn-group.actions button.action.primary',
	denyTimeOffRequestButtonCss: 'div.btn-group.actions button[status="warning"]',
	approveTimeOffRequestButtonCss: 'div.btn-group.actions button[status="success"]',
	// The "more-horizontal" toggle in the first action group: clicking it sets showActions=true, which
	// renders the second group containing Approve (success) / Deny (warning) / Archive.
	showActionsButtonCss: 'div.btn-group.actions button:has(nb-icon[icon="more-horizontal-outline"])',
	timeOffSettingsButtonCss: 'nb-card-header button.action.p-2',
	addNewPolicyButtonCss: 'div.actions-container button[status="success"]',
	editPolicyButtonCss: 'div.btn-group.actions button.action.primary',
	deletePolicyButtonCss: 'div.btn-group.actions button:has(nb-icon[icon="trash-2-outline"])',
	addNewPolicyInputCss: '[placeholder="Policy Name"]',
	backButtonCss: 'ngx-back-navigation button[status="primary"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyPolicyCss: 'div.ng-star-inserted',
	holidayNameSelectCss: 'ngx-time-off-holiday-mutation nb-select:has-text("Select Holiday name")',
	employeeSelectorCss: 'nb-select:has-text("Add or Remove Employees")',
	timeOffPolicySelectorCss: 'nb-select[id="policy"]'
};
