import {
	waitElementToHide,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex,
	verifyText,
	enterInput,
	clickButtonByIndexNoForce,
	waitForSpinnerGone,
	dispatchClick
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AppointmentsPage } from '../../../src/support/Base/pageobjects/AppointmentsPageObject';

export const bookPublicAppointmentButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.bookPublicAppointmentButtonCss);
};

export const clickBookPublicAppointmentButton = async (_text?) => {
	// "Book Public Appointment" calls bookPublicAppointment() which router.navigate(['/share/employee']).
	// Two problems with a plain force-click here:
	//  1) On load the appointment-calendar's date-range picker re-navigates the page several times
	//     (see the failure log: 5x navigations to /pages/employees/appointments?date=...). A click that
	//     fires mid-flight gets its router.navigate(['/share/employee']) immediately overridden by the
	//     pending date-picker navigation, so the URL never leaves the appointments page. Settle first.
	//  2) The page leaves fading cdk-overlay backdrops (quick-settings / "What's new" panels). A
	//     {force:true} COORDINATE click still dispatches at screen coordinates and lands on the backdrop,
	//     so the (click) handler never runs. dispatchClick fires the DOM event straight on the element.
	// The selector already uniquely targets the single status="primary" button in div.float-right, so no
	// text filter is needed.
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	await dispatchClick(AppointmentsPage.bookPublicAppointmentButtonCss);
	await getPage().waitForURL(/\/share\/employee/, { timeout: 24_000 });
	await waitForSpinnerGone();
};

// Employee select functions
export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.employeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	// ng-select (appendTo="body") opens on MOUSEDOWN and its working-employees list is loaded on PAGE
	// LOAD (combineLatest org+dateRange -> /api/employee/working), NOT on click — so the old
	// Promise.all([waitForResponse('/api/employee/working'), click]) hung 24s waiting for a request that
	// already fired. A coordinate click is also backdrop-blockable. Open via keyboard instead.
	await waitForSpinnerGone();
	const input = getPage().locator(AppointmentsPage.employeeDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectEmployeeFromDropdown = async (text: string) => {
	// The /api/employee/working fetch that fills [(items)]="employees" fires on page load of the public
	// /share/employee page and resolves ASYNC. If we type the employee name before the list is populated,
	// ng-select shows "No items found" and never re-filters once the data arrives (the panel snapshot
	// showed exactly this: combobox already holding the typed name + "No items found"). So FIRST wait for
	// the dropdown panel to actually render at least one option (the list loaded), THEN typeahead-filter.
	const input = getPage().locator(AppointmentsPage.employeeDropdownCss).locator('input').first();
	const options = getPage().locator(AppointmentsPage.employeeDropdownOptionsCss);
	// Wait for the working-employees list to populate (seeded admin + the just-added employee).
	await options.first().waitFor({ state: 'visible', timeout: 24_000 }).catch(() => {});
	// Now narrow to the target employee; searchFn matches first/last name (see EmployeeSelectorComponent).
	await input.pressSequentially(text);
	// The filtered option may not be the first match — filter by text then click the body-level option.
	const target = options.filter({ hasText: text }).first();
	await target.waitFor({ state: 'visible', timeout: 24_000 });
	await target.click({ force: true });
};
// End of Employee select functions

export const bookAppointmentButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.bookAppointmentButtonCss);
};

export const clickBookAppointmentButton = async () => {
	// bookPublicEmployeeAppointment() fetches event types then navigates to /share/employee/:id (the
	// public-appointment page). Click, then wait for that URL so the next visibility probe is on the
	// right page.
	await clickButton(AppointmentsPage.bookAppointmentButtonCss);
	await getPage().waitForURL(/\/share\/employee\/[^/]+$/, { timeout: 24_000 });
	await waitForSpinnerGone();
};

export const selectButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.appointmentButtonsCss);
};

export const clickSelectButton = async (index) => {
	// The public-appointment page shows a full-card nbSpinner while it loads event types; clicking a
	// "Select" button (selectEventType) navigates to /share/employee/:id/:eventId (the "Pick a date and
	// time" page). Settle the spinner and dispatchClick so the (click) fires through any overlay, then
	// wait for the eventId URL before the header/employee assertions.
	await waitForSpinnerGone();
	await verifyElementIsVisible(AppointmentsPage.appointmentButtonsCss);
	if (index === 0) {
		await dispatchClick(AppointmentsPage.appointmentButtonsCss);
	} else {
		await clickButtonByIndex(AppointmentsPage.appointmentButtonsCss, index);
	}
	await getPage().waitForURL(/\/share\/employee\/[^/]+\/[^/]+/, { timeout: 24_000 });
	await waitForSpinnerGone();
};

export const verifyHeader = async (text) => {
	await verifyText(AppointmentsPage.headerCss, text);
};

export const verifyEmployee = async (text) => {
	await verifyText(AppointmentsPage.employeeNameCss, text);
};

// Add employee schedule
export const scheduleButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.appointmentButtonsCss);
};

export const clickScheduleButton = async (index: number) => {
	await clickButtonByIndex(AppointmentsPage.appointmentButtonsCss, index);
};

export const dateSpecificAvailabilityTabVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.dateSpecificAvailabilityTabCss);
};

export const clickDateSpecificAvailabilityTab = async (index: number) => {
	await clickButtonByIndex(AppointmentsPage.dateSpecificAvailabilityTabCss, index);
};

export const eventTypeSelectButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.eventTypeButtonsCss);
};

export const clickEventTypeSelectButton = async (index: number) => {
	const page = getPage();
	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/event-type/')),
		page.waitForResponse((res) => res.url().includes('/api/employee/')),
		clickButtonByIndexNoForce(AppointmentsPage.eventTypeButtonsCss, index)
	]);
};

export const calendarTableVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.calendarTableCss);
};

export const clickCalendarTableRow = async () => {
	await clickButton(AppointmentsPage.calendarTableRowCss);
};

export const clickAvailableTimeCalendarTableRow = async () => {
	await clickButtonByIndex(AppointmentsPage.availableTimeCalendarTableRowsCss, 0);
};

// Book public appointment
export const agendaInputFieldVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.agendaInputFieldCss);
};

export const enterAgendaInputField = async (data: string) => {
	await enterInput(AppointmentsPage.agendaInputFieldCss, data);
};

export const bufferTimeCheckboxVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.bufferTimeCheckboxCss);
};

export const clickBufferTimeCheckbox = async () => {
	await clickButton(AppointmentsPage.bufferTimeCheckboxCss);
};

export const bufferMinutesInputFieldVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.bufferMinutesInputFieldCss);
};

export const enterBufferMinutesInputData = async (data: string) => {
	await enterInput(AppointmentsPage.bufferMinutesInputFieldCss, data);
};

export const breakTimeCheckboxVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.breakTimeCheckboxCss);
};

export const clickBreakTimeCheckbox = async () => {
	await clickButton(AppointmentsPage.breakTimeCheckboxCss);
};

export const breakTimeDateDropdownVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.breakTimeDateDropdownCss);
};

export const clickBreakTimeDateDropdown = async () => {
	await clickButton(AppointmentsPage.breakTimeDateDropdownCss);
};

export const selectBreakTimeFromDropdownOptions = async () => {
	await clickButtonByIndex(AppointmentsPage.breakTimeDateDropdownOptionsCss, 0);
};

export const breakTimeMinutesInputFieldVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.breakTimeMinutesInputCss);
};

export const enterBreakTimeMinutesInputData = async (data: string) => {
	await enterInput(AppointmentsPage.breakTimeMinutesInputCss, data);
};

export const locationInputVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.locationInputCss);
};

export const enterLocationInputData = async (data: string) => {
	await enterInput(AppointmentsPage.locationInputCss, data);
};

export const descriptionFieldVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.descriptionFieldCss);
};

export const enterDescriptionInputData = async (data: string) => {
	await enterInput(AppointmentsPage.descriptionFieldCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(AppointmentsPage.saveButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AppointmentsPage.toastrMessageCss);
};

// Verify appointments

export const verifyAppointmentConfirmedTitle = async (data: string) => {
	await verifyText(AppointmentsPage.appointmentConfirmedCss, data);
};

export const verifyEmployeeName = async (data: string) => {
	await verifyText(AppointmentsPage.appointmentDetails, data);
};

export const verifyAgenda = async (data: string) => {
	await verifyText(AppointmentsPage.appointmentDetails, data);
};

export const verifyLocation = async (data: string) => {
	await verifyText(AppointmentsPage.appointmentDetails, data);
};

export const verifyDescription = async (data: string) => {
	await verifyText(AppointmentsPage.appointmentDetails, data);
};

export const selectEmployeeFromDropdownSecond = async (text: string) => {
	await clickElementByText(AppointmentsPage.selectEmployeeDropdownOptionCss, text);
};
