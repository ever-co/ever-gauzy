import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as appointmentsPage from '../../Base/pages/Appointments.po';
import { AppointmentsPageData } from '../../Base/pagedata/AppointmentsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import { faker } from '@faker-js/faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as eventTypesPage from '../../Base/pages/EventTypes.po';
import { EventTypePageData } from '../../Base/pagedata/EventTypesPageData';



import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let firstName = faker.person.firstName();
let lastName = faker.person.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.exampleEmail();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add employee
And('User can add new employee', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addEmployee(
		manageEmployeesPage,
		firstName,
		lastName,
		username,
		employeeEmail,
		password,
		imgUrl
	);
});

And('User can visit Employees appointments page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/appointments', { timeout: pageLoadTimeout });
});

// Employee select steps
And('User can see employee select dropdown', () => {
	appointmentsPage.employeeDropdownVisible();
});

When('User click on employee select dropdown', () => {
	appointmentsPage.clickEmployeeDropdown();
});

Then('User can select employee from dropdown options', () => {
	appointmentsPage.selectEmployeeFromDropdown(`${firstName} ${lastName}`);
});
// End of Employee select steps

// Add employee schedule
And('User can see Schedules button', () => {
	appointmentsPage.scheduleButtonVisible();
});

When('User clicks on Schedules button', () => {
	appointmentsPage.clickScheduleButton(0);
});

Then('User can san see Date Specific Availability tab', () => {
	appointmentsPage.dateSpecificAvailabilityTabVisible();
});

When('User clicks Date Specific Availability tab', () => {
	appointmentsPage.clickDateSpecificAvailabilityTab(1);
});

Then('User can see Calendar table', () => {
	appointmentsPage.calendarTableVisible();
});

When('User clicks on Calendar table row', () => {
	appointmentsPage.clickCalendarTableRow();
});

// Add new event type
And('User can visit Event types page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/event-types', { timeout: pageLoadTimeout });
});

Then('User can see grid button', () => {
	eventTypesPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	eventTypesPage.gridBtnClick(1);
});

And('User can see add event type button', () => {
	eventTypesPage.addEventTypeButtonVisible();
});

When('User click on add event type button', () => {
	eventTypesPage.clickAddEventTypeButton();
});

Then('User can see employee dropdown', () => {
	eventTypesPage.selectEmployeeDropdownVisible();
});

When('User click on employee dropdown', () => {
	eventTypesPage.clickSelectEmployeeDropdown();
});

Then('User can select employee from dropdown options second', () => {
	appointmentsPage.selectEmployeeFromDropdownSecond(`${firstName} ${lastName}`);
});

And('User can see title input field', () => {
	eventTypesPage.titleInputVisible();
});

And('User can enter value for title', () => {
	eventTypesPage.enterTitleInputData(EventTypePageData.defaultEventTitle);
});

And('User can see description input field', () => {
	eventTypesPage.descriptionInputVisible();
});

And('User can enter value for description', () => {
	eventTypesPage.enterDescriptionInputData(
		EventTypePageData.defaultDescription
	);
});

And('User can see duration input field', () => {
	eventTypesPage.durationInputVisible();
});

And('User can select value for duration', () => {
	eventTypesPage.enterDurationInputData(EventTypePageData.defaultDuration);
});

And('User can checkbox', () => {
	eventTypesPage.checkboxVisible();
});

And('User can click on checkbox', () => {
	eventTypesPage.clickCheckbox();
});

And('User can see save button', () => {
	eventTypesPage.saveButtonVisible();
});

When('User click on save button', () => {
	eventTypesPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	eventTypesPage.waitMessageToHide();
});

// Book public appointment
And('User can see Book Public Appointment button', () => {
	appointmentsPage.bookPublicAppointmentButtonVisible();
});

When('User click on Book Public Appointment button', () => {
	appointmentsPage.clickBookPublicAppointmentButton(
		AppointmentsPageData.bookAppointmentButton
	);
});

Then('User can see Event Type Select button', () => {
	appointmentsPage.eventTypeSelectButtonVisible();
});

Then('User clicks on Event Type select button', () => {
	appointmentsPage.clickEventTypeSelectButton(0);
});

Then('User can see available time in Calendar table', () => {
	appointmentsPage.calendarTableVisible();
});

When('User clicks on available time in Calendar table', () => {
	appointmentsPage.clickAvailableTimeCalendarTableRow();
});

Then('User can see Agenda input field', () => {
	appointmentsPage.agendaInputFieldVisible();
});

And('User enters Agenda input field data', () => {
	appointmentsPage.enterAgendaInputField(AppointmentsPageData.agenda);
});

And('User can see Buffer time checkbox', () => {
	appointmentsPage.bufferTimeCheckboxVisible();
});

When('User clicks on Buffer time checkbox', () => {
	appointmentsPage.clickBufferTimeCheckbox();
});

Then('User can see Buffer minutes input field', () => {
	appointmentsPage.bufferMinutesInputFieldVisible();
});

And('User enters Buffer minutes input field data', () => {
	appointmentsPage.enterBufferMinutesInputData(
		AppointmentsPageData.bufferTime
	);
});

And('User can see Break time checkbox', () => {
	appointmentsPage.breakTimeCheckboxVisible();
});

When('User clicks on Break time checkbox', () => {
	appointmentsPage.clickBreakTimeCheckbox();
});

Then('User can see Break time date dropdown', () => {
	appointmentsPage.breakTimeDateDropdownVisible();
});

When('User clicks on Break time date dropdown', () => {
	appointmentsPage.clickBreakTimeDateDropdown();
});

Then('User can select Break time from dropdown options', () => {
	appointmentsPage.selectBreakTimeFromDropdownOptions();
});

And('User can see Break time minutes input field', () => {
	appointmentsPage.breakTimeMinutesInputFieldVisible();
});

And('User enters Break time minutes input field data', () => {
	appointmentsPage.enterBreakTimeMinutesInputData(
		AppointmentsPageData.bufferTime
	);
});

And('User can see location input field', () => {
	appointmentsPage.locationInputVisible();
});

And('User enters location input field data', () => {
	appointmentsPage.enterLocationInputData(AppointmentsPageData.location);
});

And('User can see description input field', () => {
	appointmentsPage.descriptionFieldVisible();
});

And('User enters description input field data', () => {
	appointmentsPage.enterDescriptionInputData(
		AppointmentsPageData.appointmentDescription
	);
});

And('User can see Save button', () => {
	appointmentsPage.saveButtonVisible();
});

When('User clicks on Save button', () => {
	appointmentsPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	appointmentsPage.waitMessageToHide();
});

// Verify appointment
And('User can verify appointment title', () => {
	appointmentsPage.verifyAppointmentConfirmedTitle(
		AppointmentsPageData.appointmentConfirmed
	);
});

And('User can verify employee name', () => {
	appointmentsPage.verifyEmployeeName(`${firstName} ${lastName}`);
});

And('User can verify agenda', () => {
	appointmentsPage.verifyAgenda(AppointmentsPageData.agenda);
});

And('User can verify location', () => {
	appointmentsPage.verifyLocation(AppointmentsPageData.location);
});

And('User can verify description', () => {
	appointmentsPage.verifyDescription(
		AppointmentsPageData.appointmentDescription
	);
});
