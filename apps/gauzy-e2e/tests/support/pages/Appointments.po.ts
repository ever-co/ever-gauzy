import {
	clickButtonDouble,
	waitElementToHide,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex,
	verifyText,
	enterInput,
	clickButtonByIndexNoForce
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AppointmentsPage } from '../../../src/support/Base/pageobjects/AppointmentsPageObject';

export const bookPublicAppointmentButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.bookPublicAppointmentButtonCss);
};

export const clickBookPublicAppointmentButton = async (text) => {
	await clickElementByText(AppointmentsPage.bookPublicAppointmentButtonCss, text);
};

// Employee select functions
export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.employeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	const page = getPage();
	await Promise.all([
		page.waitForResponse((res) => res.url().includes('/api/employee/working')),
		clickButton(AppointmentsPage.employeeDropdownCss)
	]);
	await clickButtonDouble(AppointmentsPage.employeeDropdownCss);
};

export const selectEmployeeFromDropdown = async (text: string) => {
	await clickElementByText(AppointmentsPage.employeeDropdownOptionsCss, text);
};
// End of Employee select functions

export const bookAppointmentButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.bookAppointmentButtonCss);
};

export const clickBookAppointmentButton = async () => {
	await clickButton(AppointmentsPage.bookAppointmentButtonCss);
};

export const selectButtonVisible = async () => {
	await verifyElementIsVisible(AppointmentsPage.appointmentButtonsCss);
};

export const clickSelectButton = async (index) => {
	await clickButtonByIndex(AppointmentsPage.appointmentButtonsCss, index);
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
