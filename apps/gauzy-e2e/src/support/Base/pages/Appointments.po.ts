import { waitElementToHide, waitUntil } from './../utils/util';
import {
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex,
	verifyText,
	enterInput
} from '../utils/util';
import { AppointmentsPage } from '../pageobjects/AppointmentsPageObject';

export const bookPublicAppointmentButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.bookPublicAppointmentButtonCss);
};

export const clickBookPublicAppointmentButton = (text) => {
	clickElementByText(AppointmentsPage.bookPublicAppointmentButtonCss, text);
};

// Employee select functions
export const employeeDropdownVisible = () => {
	verifyElementIsVisible(AppointmentsPage.employeeDropdownCss);
};

export const clickEmployeeDropdown = () => {
	clickButton(AppointmentsPage.employeeDropdownCss);
};

export const selectEmployeeFromDropdown = (text: string) => {
	clickElementByText(AppointmentsPage.employeeDropdownOptionsCss, text);
	waitUntil(2000);
};
// End of Employee select functions

export const bookAppointmentButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.bookAppointmentButtonCss);
};

export const clickBookAppointmentButton = () => {
	clickButton(AppointmentsPage.bookAppointmentButtonCss);
};

export const selectButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.appointmentButtonsCss);
};

export const clickSelectButton = (index) => {
	clickButtonByIndex(AppointmentsPage.appointmentButtonsCss, index);
};

export const verifyHeader = (text) => {
	verifyText(AppointmentsPage.headerCss, text);
};

export const verifyEmployee = (text) => {
	verifyText(AppointmentsPage.employeeNameCss, text);
};

// Add employee schedule
export const scheduleButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.appointmentButtonsCss);
};

export const clickScheduleButton = (index: number) => {
	clickButtonByIndex(AppointmentsPage.appointmentButtonsCss, index);
};

export const dateSpecificAvailabilityTabVisible = () => {
	verifyElementIsVisible(AppointmentsPage.dateSpecificAvailabilityTabCss);
};

export const clickDateSpecificAvailabilityTab = (index: number) => {
	clickButtonByIndex(AppointmentsPage.dateSpecificAvailabilityTabCss, index);
};

export const eventTypeSelectButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.eventTypeButtonsCss);
};

export const clickEventTypeSelectButton = (index: number) => {
	clickButtonByIndex(AppointmentsPage.eventTypeButtonsCss, index);
	waitUntil(3000);
};

export const calendarTableVisible = () => {
	verifyElementIsVisible(AppointmentsPage.calendarTableCss);
};

export const clickCalendarTableRow = () => {
	clickButton(AppointmentsPage.calendarTableRowCss);
};

export const clickAvailableTimeCalendarTableRow = () => {
	clickButtonByIndex(AppointmentsPage.availableTimeCalendarTableRowsCss, 0);
};

// Book public appointment
export const agendaInputFieldVisible = () => {
	verifyElementIsVisible(AppointmentsPage.agendaInputFieldCss);
};

export const enterAgendaInputField = (data: string) => {
	enterInput(AppointmentsPage.agendaInputFieldCss, data);
};

export const bufferTimeCheckboxVisible = () => {
	verifyElementIsVisible(AppointmentsPage.bufferTimeCheckboxCss);
};

export const clickBufferTimeCheckbox = () => {
	clickButton(AppointmentsPage.bufferTimeCheckboxCss);
};

export const bufferMinutesInputFieldVisible = () => {
	verifyElementIsVisible(AppointmentsPage.bufferMinutesInputFieldCss);
};

export const enterBufferMinutesInputData = (data: string) => {
	enterInput(AppointmentsPage.bufferMinutesInputFieldCss, data);
};

export const breakTimeCheckboxVisible = () => {
	verifyElementIsVisible(AppointmentsPage.breakTimeCheckboxCss);
};

export const clickBreakTimeCheckbox = () => {
	clickButton(AppointmentsPage.breakTimeCheckboxCss);
};

export const breakTimeDateDropdownVisible = () => {
	verifyElementIsVisible(AppointmentsPage.breakTimeDateDropdownCss);
};

export const clickBreakTimeDateDropdown = () => {
	clickButton(AppointmentsPage.breakTimeDateDropdownCss);
};

export const selectBreakTimeFromDropdownOptions = () => {
	clickButtonByIndex(AppointmentsPage.breakTimeDateDropdownOptionsCss, 0);
};

export const breakTimeMinutesInputFieldVisible = () => {
	verifyElementIsVisible(AppointmentsPage.breakTimeMinutesInputCss);
};

export const enterBreakTimeMinutesInputData = (data: string) => {
	enterInput(AppointmentsPage.breakTimeMinutesInputCss, data);
};

export const locationInputVisible = () => {
	verifyElementIsVisible(AppointmentsPage.locationInputCss);
};

export const enterLocationInputData = (data: string) => {
	enterInput(AppointmentsPage.locationInputCss, data);
};

export const descriptionFieldVisible = () => {
	verifyElementIsVisible(AppointmentsPage.descriptionFieldCss);
};

export const enterDescriptionInputData = (data: string) => {
	enterInput(AppointmentsPage.descriptionFieldCss, data);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(AppointmentsPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(AppointmentsPage.saveButtonCss);
};

export const waitMessageToHide = () => {
	waitElementToHide(AppointmentsPage.toastrMessageCss);
};

// Verify appointments

export const verifyAppointmentConfirmedTitle = (data: string) => {
	verifyText(AppointmentsPage.appointmentConfirmedCss, data);
};

export const verifyEmployeeName = (data: string) => {
	verifyText(AppointmentsPage.appointmentDetails, data);
};

export const verifyAgenda = (data: string) => {
	verifyText(AppointmentsPage.appointmentDetails, data);
};

export const verifyLocation = (data: string) => {
	verifyText(AppointmentsPage.appointmentDetails, data);
};

export const verifyDescription = (data: string) => {
	verifyText(AppointmentsPage.appointmentDetails, data);
};
