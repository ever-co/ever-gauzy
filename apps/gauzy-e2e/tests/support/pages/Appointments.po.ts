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

export const clickBookPublicAppointmentButton = async (text) => {
	// "Book Public Appointment" calls bookPublicAppointment() which router.navigate(['/share/employee']).
	// Wait for the URL to actually land on the public pick-employee page before the next step probes the
	// dropdown — otherwise verifyElementIsVisible matches the always-present GLOBAL header selector and
	// we never leave the appointments page.
	await clickElementByText(AppointmentsPage.bookPublicAppointmentButtonCss, text);
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
	const input = getPage().locator(AppointmentsPage.employeeDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectEmployeeFromDropdown = async (text: string) => {
	// Typeahead-filter the open ng-select to the target employee, then click the body-level option.
	const input = getPage().locator(AppointmentsPage.employeeDropdownCss).locator('input').first();
	await input.pressSequentially(text);
	await clickElementByText(AppointmentsPage.employeeDropdownOptionsCss, text);
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
