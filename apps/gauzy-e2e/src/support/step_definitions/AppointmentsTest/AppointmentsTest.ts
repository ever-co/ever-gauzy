import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as appointmentsPage from '../../Base/pages/Appointments.po';
import { AppointmentsPageData } from '../../Base/pagedata/AppointmentsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let employeeEmail = faker.internet.email();
let imgUrl = faker.image.avatar();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add employee
And('User can add new employee', () => {
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

// Book public appointment
And('User can visit Employees appointments page', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/employees/appointments');
});

Then('User can see book public appointment button', () => {
	appointmentsPage.bookPublicAppointmentButtonVisible();
});

When('User click on book public appointment button', () => {
	appointmentsPage.clickBookPublicAppointmentButton(
		AppointmentsPageData.bookAppointmentButton
	);
});

Then('User will see employee select', () => {
	appointmentsPage.employeeSelectVisible();
});

When('User click on employee select', () => {
	appointmentsPage.clickEmployeeSelect();
});

Then('User can see employee dropdown options', () => {
	appointmentsPage.employeeDropdownVisible();
});

And('User can choose employee from dropdown', () => {
	appointmentsPage.selectEmployeeFromDropdown(`${firstName} ${lastName}`);
});

And('User can see book appontment button', () => {
	appointmentsPage.bookAppointmentButtonVisible();
});

When('User click on book appontment button', () => {
	appointmentsPage.clickBookAppointmentButton();
});

Then('User can verify employee', () => {
	appointmentsPage.verifyEmployee(`${firstName} ${lastName}`);
});
