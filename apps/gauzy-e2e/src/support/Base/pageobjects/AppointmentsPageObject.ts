export const AppointmentsPage = {
	// Appointments calendar header: #10345 (d58dd759cb) replaced the `div.float-right` action group with
	// `div.header-actions` (timezone info + Schedules[info] + Event Types[warning] + Book Public
	// Appointment[primary]); the time-zone "Change" button sits one level deeper (div.timezone-info) and
	// is status="basic", so the direct-child primary button is the booking one.
	bookPublicAppointmentButtonCss: 'ngx-appointment-calendar div.header-actions > button[status="primary"]',
	// The routed calendar component's card — proves the appointments route actually rendered (the card,
	// not the host: a custom-element host is inline by default and can have an empty bounding box).
	appointmentCalendarCss: 'ngx-appointment-calendar nb-card',
	// Scope to ga-pick-employee: the public /share/employee page's ga-employee-selector. The bare
	// 'ga-employee-selector > ng-select' also matches the GLOBAL header employee selector (always present
	// on /pages/...), so the unscoped selector opened the wrong dropdown when navigation hadn't settled.
	employeeDropdownCss: 'ga-pick-employee ga-employee-selector ng-select',
	// ng-select with appendTo="body": options render in a body-level ng-dropdown-panel.
	employeeDropdownOptionsCss: 'ng-dropdown-panel div.ng-option',
	// /share/employee "Select an employee" card: #10345 (d58dd759cb) moved the Book button out of the
	// `div.center-div` row (it was status="success") into the card footer as a full-width primary
	// `button.book-button`, [disabled] until the organization is known.
	bookAppointmentButtonCss: 'ga-pick-employee nb-card-footer.pick-footer button.book-button',
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
