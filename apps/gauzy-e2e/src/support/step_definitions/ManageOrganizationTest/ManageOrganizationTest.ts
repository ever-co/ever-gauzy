import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as addOrganizationPage from '../../Base/pages/AddOrganization.po';
import { AddOrganizationPageData } from '../../Base/pagedata/AddOrganizationPageData';
import * as manageOrganizationPage from '../../Base/pages/ManageOrganization.po';
import * as faker from 'faker';
import { ManageOrganizationPageData } from '../../Base/pagedata/ManageOrganizationPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as logoutPage from '../../Base/pages/Logout.po';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let organizationName = faker.company.companyName();
let taxId = faker.random.alphaNumeric();
let street = faker.address.streetAddress();

// Login with email
Given('Login with default credentials', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
});

// Add new organization
And('User can add new organization', () => {
	dashboardPage.verifyAccountingDashboardIfVisible();
	CustomCommands.addOrganization(
		addOrganizationPage,
		organizationName,
		AddOrganizationPageData,
		taxId,
		street
	);
});

// Manage organization
And('User can see grid button', () => {
	manageOrganizationPage.gridBtnExists();
});

And('User can click on second grid button to change view', () => {
	manageOrganizationPage.gridBtnClick(1);
});

When('User select organizations table row', () => {
	manageOrganizationPage.selectTableRow();
});

Then('Manage button will become active', () => {
	manageOrganizationPage.manageBtnExists();
});

When('User click on manage button', () => {
	manageOrganizationPage.manageBtnClick();
});

Then('User can enter organization name', () => {
	manageOrganizationPage.enterOrganizationName(organizationName);
});

And('User can select currency', () => {
	manageOrganizationPage.selectCurrency(ManageOrganizationPageData.currency);
});

And('User can enter official name', () => {
	manageOrganizationPage.enterOfficialName(organizationName);
});

And('User can enter tax id', () => {
	manageOrganizationPage.enterTaxId(taxId);
});

And('User can see tab button', () => {
	manageOrganizationPage.tabButtonVisible();
});

When('User click on second tab button', () => {
	manageOrganizationPage.clickTabButton(1);
});

Then('User can see country dropdown', () => {
	manageOrganizationPage.countryDropdownVisible();
});

When('User click on country dropdown', () => {
	manageOrganizationPage.clickCountryDropdown();
});

Then('User can select country from dropdown options', () => {
	manageOrganizationPage.selectCountryFromDropdown(
		ManageOrganizationPageData.country
	);
});

And('User can see city input field', () => {
	manageOrganizationPage.cityInputVisible();
});

And('User can enter value for city', () => {
	manageOrganizationPage.enterCityInputData(ManageOrganizationPageData.city);
});

And('User can see post code input field', () => {
	manageOrganizationPage.postcodeInputVisible();
});

And('User can enter value for post code', () => {
	manageOrganizationPage.enterPostcodeInputData(
		ManageOrganizationPageData.postcode
	);
});

And('User can see street input field', () => {
	manageOrganizationPage.streetInputVisible();
});

And('User can enter value for street', () => {
	manageOrganizationPage.enterStreetInputData(street);
});

And('User can see tab button', () => {
	manageOrganizationPage.tabButtonVisible();
});

When('User click on third tab button', () => {
	manageOrganizationPage.clickTabButton(2);
});

Then('User can see time zone dropdown', () => {
	manageOrganizationPage.timeZoneDropdownVisible();
});

When('User click on time zone dropdown', () => {
	manageOrganizationPage.clickTimeZoneDropdown();
});

Then('User can select time zone option from dropdown', () => {
	manageOrganizationPage.selectTimeZoneFromDropdown(
		ManageOrganizationPageData.timeZone
	);
});

And('User can see start of week dropdown', () => {
	manageOrganizationPage.startOfWeekDropdownVisible();
});

When('User click on start of week dropdown', () => {
	manageOrganizationPage.clickStartOfWeekDropdown();
});

Then('User can select start of week option from dropdown', () => {
	manageOrganizationPage.selectStartOfWeekFromDropdown(
		ManageOrganizationPageData.startOfWeek
	);
});

And('User can see date type dropdown', () => {
	manageOrganizationPage.dateTypeDropdownVisible();
});

When('User click on date type dropdown', () => {
	manageOrganizationPage.clickDateTypeDropdown();
});

Then('User can select date type from dropdown options', () => {
	manageOrganizationPage.selectDateTypeFromDropdown(
		ManageOrganizationPageData.dateType
	);
});

And('User can see region dropdown', () => {
	manageOrganizationPage.regionDropdownVisible();
});

When('User click on region dropdown', () => {
	manageOrganizationPage.clickRegionDropdown();
});

Then('User can select region from dropdown options', () => {
	manageOrganizationPage.selectRegionFromDropdown(
		ManageOrganizationPageData.region
	);
});

And('User can see number format dropdown', () => {
	manageOrganizationPage.numberFormatDropdownVisible();
});

When('User click on number format dropdown', () => {
	manageOrganizationPage.clickNumberFormatDropdown();
});

Then('User can select number format from dropdown options', () => {
	manageOrganizationPage.selectNumberFormatFromDropdown(
		ManageOrganizationPageData.numberFormat
	);
});

And('User can see date format dropdown', () => {
	manageOrganizationPage.dateFormatDropdownVisible();
});

When('User click on date format dropdown', () => {
	manageOrganizationPage.clickDateFormatDropdown();
});

Then('User can select date format from dropdown options', () => {
	manageOrganizationPage.selectDateFormatFromDropdown();
});

When('User click on first tab button', () => {
	manageOrganizationPage.clickTabButton(0);
});

Then('User can see save button', () => {
	manageOrganizationPage.saveButtonVisible();
});

When('User click on save button', () => {
	manageOrganizationPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	manageOrganizationPage.waitMessageToHide();
});

And('User can verify organization', () => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organizations');
	manageOrganizationPage.verifyOrganizationExists(organizationName);
});
