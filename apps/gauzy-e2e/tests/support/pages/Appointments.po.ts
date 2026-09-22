import { expect } from '@playwright/test';
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
	// The /api/employee/working fetch that fills [(items)]="employees" (EmployeeSelectorComponent) fires
	// from a debounced combineLatest([organization$, dateRange$]) on the public /share/employee page and
	// resolves ASYNC. The post-round-3 failure DOM was the textbook symptom: the combobox already held the
	// typed name "Milton Schroeder" but the panel showed "No items found" — we had typed BEFORE the list
	// loaded, and ng-select does NOT re-run its filter against options that arrive later (the search term
	// is sticky), so the previously-typed query permanently hid every option.
	//
	// Two changes make this deterministic:
	//  1) BLOCK on at least one real option appearing (the list actually loaded) before typing anything —
	//     poll the body-level panel and re-open it via keyboard if a transient navigation/spinner closed
	//     it. No silent .catch() that lets us type into an empty list.
	//  2) Filter by FIRST NAME only. searchEmployee() is keyword-based (matches firstName OR lastName), and
	//     the rendered option label is truncated via getShortenedName(), so the safest unique-enough query
	//     is the faker first name — then click the body-level option whose text contains the full name.
	const page = getPage();
	const input = page.locator(AppointmentsPage.employeeDropdownCss).locator('input').first();
	// ng-select renders its empty-state "No items found" row ALSO as a div.ng-option (with
	// .ng-option-disabled), so a bare div.ng-option count is >0 even when the list hasn't loaded — which is
	// exactly the post-round-3 trap. Gate on REAL options only: div.ng-option minus the disabled row.
	const realOptions = page.locator(`${AppointmentsPage.employeeDropdownOptionsCss}:not(.ng-option-disabled)`);
	const firstName = text.split(' ')[0];

	// 1) Wait (with re-open retries) for the working-employees list to populate before touching the filter.
	//    A real (non-disabled) option means [(items)] actually resolved.
	await expect
		.poll(
			async () => {
				if ((await realOptions.count()) > 0) {
					return true;
				}
				// Panel may have collapsed on a transient re-navigation/spinner — re-open via keyboard.
				await input.focus();
				await page.keyboard.press('ArrowDown');
				await page.waitForTimeout(500);
				return (await realOptions.count()) > 0;
			},
			{ timeout: 24_000, intervals: [500, 1000, 1500] }
		)
		.toBe(true);

	// 2) Typeahead-filter by first name (searchEmployee() is keyword-based; the option label is truncated by
	//    getShortenedName(), so first name is the safest query), then click the real option matching it.
	await input.focus();
	await input.fill('');
	await input.pressSequentially(firstName);
	// Prefer the full-name match; fall back to the first-name-filtered real option (truncated labels).
	const byFullName = realOptions.filter({ hasText: text }).first();
	const byFirstName = realOptions.filter({ hasText: firstName }).first();
	const target = (await byFullName.count()) > 0 ? byFullName : byFirstName;
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
