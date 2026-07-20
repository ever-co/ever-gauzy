export const AppointmentsPage = {
	bookPublicAppointmentButtonCss: 'ngx-appointment-calendar div.float-right button[status="primary"]',
	// Scope to ga-pick-employee: the public /share/employee page's ga-employee-selector. The bare
	// 'ga-employee-selector > ng-select' also matches the GLOBAL header employee selector (always present
	// on /pages/...), so the unscoped selector opened the wrong dropdown when navigation hadn't settled.
	employeeDropdownCss: 'ga-pick-employee ga-employee-selector ng-select',
	// ng-select with appendTo="body": options render in a body-level ng-dropdown-panel.
	employeeDropdownOptionsCss: 'ng-dropdown-panel div.ng-option',
	bookAppointmentButtonCss: 'div.center-div > button[status="success"]',
	headerCss: 'div.main-header > h4',
	employeeNameCss: 'div.employee-details > span.employee-name',
	appointmentButtonsCss: 'ga-public-appointment button[status="success"]',
	dateSpecificAvailabilityTabCss: 'nb-route-tabset > ul.route-tabset > li',
	eventTypeButtonsCss: 'button[status="success"]',
	calendarTableCss: 'table.fc-scrollgrid',
	calendarTableRowCss: '.fc-timegrid-slots > table > tbody > tr:nth-child(3) > td:nth-child(2)',
	availableTimeCalendarTableRowsCss: '.fc-timegrid-event[style="background-color: green;"]',
	agendaInputFieldCss: '#agenda',
	bufferTimeCheckboxCss: 'nb-checkbox[formcontrolname="bufferTime"]',
	bufferMinutesInputFieldCss: '#bufferTimeInMins',
	breakTimeCheckboxCss: 'nb-checkbox[formcontrolname="breakTime"]',
	breakTimeDateDropdownCss: 'ga-timer-picker[formcontrolname="breakStartTime"] ng-select',
	breakTimeDateDropdownOptionsCss: 'ng-dropdown-panel > div.ng-dropdown-panel-items div.ng-option',
	breakTimeMinutesInputCss: '#breakTimeInMins',
	locationInputCss: 'input#location',
	descriptionFieldCss: '#description',
	saveButtonCss: 'button[status="success"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	appointmentConfirmedCss: 'div.main-header > h4',
	appointmentDetails: '.p-2 span',
	selectEmployeeDropdownOptionCss: 'nb-option-list > ul.option-list > nb-option'
};
