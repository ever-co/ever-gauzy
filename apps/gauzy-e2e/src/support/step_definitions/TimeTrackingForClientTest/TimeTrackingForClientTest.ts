import * as faker from 'faker';
import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { CustomCommands } from '../../commands';
import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import { ClientsData } from '../../Base/pagedata/ClientsPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as clientsPage from '../../Base/pages/Clients.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as timeTrackingForClient from '../../Base/pages/TimeTrackingForClient.po';
import { waitUntil } from '../../Base/utils/util';
import { TimeTrackingForClientPageData } from '../../Base/pagedata/TimeTrackingForClientPageData';


const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let projectName = faker.name.jobTitle()

let email = faker.internet.email();
let fullName = faker.name.firstName() + ' ' + faker.name.lastName();
let city = faker.address.city();
let postcode = faker.address.zipCode();
let street = faker.address.streetAddress();
let website = faker.internet.url();


let firstName = faker.name.firstName();
let lastName = faker.name.lastName();
let username = faker.internet.userName();
let password = faker.internet.password();
let imgUrl = faker.image.avatar();
let employeeEmail = faker.internet.email();

let employeeFullName = `${firstName} ${lastName}`;

// Login with email

Given('Login with default credentials',()=>{
    CustomCommands.login(loginPage, LoginPageData, dashboardPage)
})

//Add employee
Then('User can add new employee', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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
// Add new client
And('User can add new client', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	CustomCommands.addClient(
		clientsPage,
		fullName,
		email,
		website,
		city,
		postcode,
		street,
		ClientsData,
		employeeFullName
	);
});

//Logout
And('User can logout', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
});

//Login as employee

And('Employee can see login page', () => {
	loginPage.verifyLoginText();
});

And('Employee can see email input', () => {
	loginPage.clearEmailField();
});

And('Employee can enter value for employee email', () => {
	loginPage.enterEmail(employeeEmail);
});

And('Employee can see password input', () => {
	loginPage.clearPasswordField();
});

And('Employee can enter value for employee password', () => {
	loginPage.enterPassword(password);
});

When('Employee click on login button', () => {
	loginPage.clickLoginButton();
});

Then('Employee will see Create button', () => {
	dashboardPage.verifyCreateButton();
});

//Record time for the new client and verify

And('Employee can see timer', () => {
	timeTrackingForClient.timerVisible();
});

When('Employee click on timer', () => {
	timeTrackingForClient.clickTimer();
});

Then('Employee can see timer button', () => {
	timeTrackingForClient.timerBtnVisible();
});

And('Employee can see client select', () => {
	timeTrackingForClient.clientSelectVisible();
});

When('Employee click on client select', () => {
	timeTrackingForClient.clickClientSelect();
});

Then('Employee can select client from dropdown options', () => {
	timeTrackingForClient.selectOptionFromDropdown(0);
});

When('Employee click on start timer button', () => {
	timeTrackingForClient.clickStartTimerBtn();
});

Then('Employee can let timer work for 5 seconds', () => {
	waitUntil(5000);
})

And('Employee can see stop timer button', () => {
	timeTrackingForClient.stopTimerBtnVisible();
});

When('Employee click on stop timer button', () => {
	timeTrackingForClient.clickStopTimerBtn();
});

Then('Employee can see view timesheet button', () => {
	timeTrackingForClient.viewTimesheetbtnVisible();
});

When('Employee click on view timesheet button', () => {
	timeTrackingForClient.clickViewTimesheetBtn();
});

Then('Employee can see view button', () => {
    timeTrackingForClient.viewViewBtnVisible();
});
When('Employee click on view button', () => {
    timeTrackingForClient.clickOnViewBtn();
});

Then('Employee can verify the customer name is recorded', () =>{
    timeTrackingForClient.verifyCustomerName(fullName);
});