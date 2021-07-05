import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as addOrganizationPage from '../../Base/pages/AddOrganization.po';
import * as faker from 'faker';
import { AddOrganizationPageData } from '../../Base/pagedata/AddOrganizationPageData';
import * as deleteOrganizationPage from '../../Base/pages/DeleteOrganization.po';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

let organizationName = faker.company.companyName();
let taxId = faker.random.alphaNumeric();
let street = faker.address.streetAddress();

// Login with email
Given('Login with default credentials and visit Organizations page', () => {
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organizations');
});

// Add new organization
Then('User can see Add new organization button', () => {
	addOrganizationPage.addBtnExists();
});

When('User click on Add new organization button', () => {
	addOrganizationPage.addBtnClick();
});

Then('User can add value for organization name', () => {
	addOrganizationPage.enterOrganizationName(organizationName);
});

And('User can select currency', () => {
	addOrganizationPage.selectCurrency(AddOrganizationPageData.currency);
});

And('User can enter value for official name', () => {
	addOrganizationPage.enterOfficialName(organizationName);
});

And('User can add tax id value', () => {
	addOrganizationPage.enterTaxId(taxId);
});

When('User click on Next button', () => {
	addOrganizationPage.clickOnNextButton();
});

Then('User can see country dropdown', () => {
	addOrganizationPage.countryDropdownVisible();
});

When('User click on country dropdown', () => {
	addOrganizationPage.clickCountryDropdown();
});

Then('User can select country from dropdown option', () => {
	addOrganizationPage.selectCountryFromDropdown(
		AddOrganizationPageData.country
	);
});

And('User can see city input field', () => {
	addOrganizationPage.cityInputVisible();
});

And('User can add value for city', () => {
	addOrganizationPage.enterCityInputData(AddOrganizationPageData.city);
});

And('User can see post code input field', () => {
	addOrganizationPage.postcodeInputVisible();
});

And('User can add value for post code', () => {
	addOrganizationPage.enterPostcodeInputData(
		AddOrganizationPageData.postcode
	);
});

And('User can see street input field', () => {
	addOrganizationPage.streetInputVisible();
});

And('User can add value for street', () => {
	addOrganizationPage.enterStreetInputData(street);
});

Then('User can click on Next button', () => {
	addOrganizationPage.clickOnNextButton();
});

And('User can see bonus dropdown', () => {
	addOrganizationPage.bonusTypeDropdownVisible();
});

When('User click on bonus dropdown', () => {
	addOrganizationPage.clickBonusTypeDropdown();
});

Then('User can select bonus from dropdown options', () => {
	addOrganizationPage.selectBonusTypeFromDropdown(
		AddOrganizationPageData.bonusType
	);
});

And('User can see bonus input field', () => {
	addOrganizationPage.bonusPercentageInputVisible();
});

And('User can enter value for bonus', () => {
	addOrganizationPage.enterBonusPercentageInputData(
		AddOrganizationPageData.bonusPercentage
	);
});

Then('User can click next button', () => {
	addOrganizationPage.clickOnNextButton();
});

And('User can see time zone dropdown', () => {
	addOrganizationPage.timeZoneDropdownVisible();
});

When('User click on time zone dropdown', () => {
	addOrganizationPage.clickTimeZoneDropdown();
});

Then('User can select time zone from dropdown options', () => {
	addOrganizationPage.selectTimeZoneFromDropdown(
		AddOrganizationPageData.timeZone
	);
});

And('User can see start of week dropdown', () => {
	addOrganizationPage.startOfWeekDropdownVisible();
});

When('User click on start of week dropdown', () => {
	addOrganizationPage.clickStartOfWeekDropdown();
});

Then('User can select day of week from dropdown options', () => {
	addOrganizationPage.selectStartOfWeekFromDropdown(
		AddOrganizationPageData.startOfWeek
	);
});

And('User can see date type dropdown', () => {
	addOrganizationPage.dateTypeDropdownVisible();
});

When('User click on date type dropdown', () => {
	addOrganizationPage.clickDateTypeDropdown();
});

Then('User can select date type from dropdown options', () => {
	addOrganizationPage.selectDateTypeFromDropdown(
		AddOrganizationPageData.dateType
	);
});

And('User can see region dropdown', () => {
	addOrganizationPage.regionDropdownVisible();
});

When('User click on region dropdown', () => {
	addOrganizationPage.clickRegionDropdown();
});

Then('User can select region from dropdown options', () => {
	addOrganizationPage.selectRegionFromDropdown(
		AddOrganizationPageData.region
	);
});

And('User can see number format dropdown', () => {
	addOrganizationPage.numberFormatDropdownVisible();
});

When('User click on number format dropdown', () => {
	addOrganizationPage.clickNumberFormatDropdown();
});

Then('User can select number format from dropdown options', () => {
	addOrganizationPage.selectNumberFormatFromDropdown(
		AddOrganizationPageData.numberFormat
	);
});

And('User can see date format dropdown', () => {
	addOrganizationPage.dateFormatDropdownVisible();
});

When('User click on date format dropdown', () => {
	addOrganizationPage.clickDateFormatDropdown();
});

Then('User can select date format from dropdown options', () => {
	addOrganizationPage.selectDateFormatFromDropdown();
});

And('User can see expiry date input field', () => {
	addOrganizationPage.expiryPeriodInputVisible();
});

And('User can enter value for expiry date', () => {
	addOrganizationPage.enterExpiryPeriodInputData(
		AddOrganizationPageData.expiryPeriod
	);
});

When('User click on last Next button', () => {
	addOrganizationPage.clickOnNextButton();
});

Then('Notification message will appear', () => {
	addOrganizationPage.waitMessageToHide();
});

And('User can verify organization was created', () => {
	addOrganizationPage.verifyOrganizationExists(organizationName);
});

// Delete organization
Then('User can see grid button', () => {
	deleteOrganizationPage.gridBtnExists();
});

And('User can click on grid button to change view', () => {
	deleteOrganizationPage.gridBtnClick();
});

And('User can see delete button', () => {
	deleteOrganizationPage.deleteBtnExists();
});

When('User click on delete button', () => {
	deleteOrganizationPage.deleteBtnClick();
});

Then('User can see confirm delete button', () => {
	deleteOrganizationPage.confirmBtnExists();
});

When('User click on confirm delete button', () => {
	deleteOrganizationPage.confirmBtnClick();
});

Then('Notification message will appear', () => {
	addOrganizationPage.waitMessageToHide();
});
