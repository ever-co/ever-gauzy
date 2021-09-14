import * as faker from 'faker';
import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';
import { CustomCommands } from '../../commands';
import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as timeTrackingWithPausePage from '../../Base/pages/TimeTrackingWithPause.po';
import { waitUntil } from '../../Base/utils/util';
import { TimeTrackingWithPausePageData } from '../../Base/pagedata/TimeTracingWithPausePageData';


const pageLoadTimeout = Cypress.config('pageLoadTimeout');


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

//Generate work time

And('Employee can see timer', () => {
	timeTrackingWithPausePage.timerVisible();
});

When('Employee click on timer', () => {
	timeTrackingWithPausePage.clickTimer();
});

Then('Employee can see timer button', () => {
	timeTrackingWithPausePage.timerBtnVisible();
});

When('Employee click on timer button', () => {
	timeTrackingWithPausePage.clickTimerBtn(1);
});

And('Employee can see start timer button', () => {
	timeTrackingWithPausePage.startTimerBtnVisible();
});

When('Employee click on start timer button', () => {
	timeTrackingWithPausePage.clickStartTimerBtn();
});

Then('Employee can let timer work for 5 seconds', () => {
	waitUntil(5000);
})

And('Employee can see stop timer button', () => {
	timeTrackingWithPausePage.clickTimer();
	timeTrackingWithPausePage.stopTimerBtnVisible();
});

When('Employee click on stop timer button', () => {
	timeTrackingWithPausePage.clickStopTimerBtn();
});

And('Employee wait button to change', () => {
	waitUntil(3000);
});

Then('Employee can see again start timer button', () => {
	timeTrackingWithPausePage.startTimerBtnVisible();
});

When('Employee click on start timer button', () => {
	timeTrackingWithPausePage.clickStartTimerBtn();
});

Then('Employee can let timer work for 5 seconds', () => {
	waitUntil(5000);
})

And('Employee can see stop timer button again', () => {
	timeTrackingWithPausePage.stopTimerBtnVisible();
});

When('Employee click on stop timer button', () => {
	timeTrackingWithPausePage.clickStopTimerBtn();
});

Then('Employee can see again start timer button', () => {
	timeTrackingWithPausePage.startTimerBtnVisible();
});


//Check the recorded time 

Then('Employee can see view timesheet button', () => {
	timeTrackingWithPausePage.viewTimesheetbtnVisible();
});

When('Employee click on view timesheet button', () => {
	timeTrackingWithPausePage.clickViewTimesheetBtn();
});

Then('Employee verify first time record', () =>{
	timeTrackingWithPausePage.verifyWorkTimeRecorded(1, TimeTrackingWithPausePageData.tracked)
});

And('Employee verify second time record', () =>{
	timeTrackingWithPausePage.verifyWorkTimeRecorded(7, TimeTrackingWithPausePageData.tracked)
});

Then('Employee can see first delete button',()=>{
	timeTrackingWithPausePage.viewRecordedTimeDeleteBtn(0)
});

Then('Employee can see second delete button',()=>{
	timeTrackingWithPausePage.viewRecordedTimeDeleteBtn(1)
});

When ('Employee click on delete button',()=>{
	timeTrackingWithPausePage.clickRecordedTimeDeleteBtn(1)
});

Then ('Employee can see confirm dialog', ()=> {
	timeTrackingWithPausePage.notificationDialogVisible()
});

When('Employee can click confirm dialog button', () => {
	timeTrackingWithPausePage.clickNotificationButton()
});

Then ('Employee refresh',()=>{
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, {email: employeeEmail, password: password}, dashboardPage);

	cy.visit('/#/pages/employees/timesheets/daily', { timeout: pageLoadTimeout });

});


Then ('Employee can verify time',()=>{
	timeTrackingWithPausePage.verifyTimerTime(TimeTrackingWithPausePageData.timerTime)
	
});



/*  Then Employee can let timer work for 5 seconds
    And Employee can see stop timer button
    When Employee click on stop timer button
    Then Employee can see again start timer button */