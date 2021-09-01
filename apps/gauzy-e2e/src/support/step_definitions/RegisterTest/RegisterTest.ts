import * as registerPage from '../../Base/pages/Register.po';
import * as loginPage from '../../Base/pages/Login.po';
import * as onboardingPage from '../../Base/pages/Onboarding.po';
import * as faker from 'faker';
import { OnboardingPageData } from '../../Base/pagedata/OnboardingPageData';
import * as dashboradPage from '../../Base/pages/Dashboard.po';
import * as logoutPage from '../../Base/pages/Logout.po';
import { RegisterPageData } from '../../Base/pagedata/RegisterPageData';

import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let fullName = faker.name.findName();
let email = faker.internet.email();
let pass = faker.internet.password();
let organizationName = faker.company.companyName();
let taxId = faker.random.alphaNumeric();
let street = faker.address.streetAddress();

// Create new account
Given('Visit home page as unauthorized user', () => {
	cy.visit('/', { timeout: pageLoadTimeout });
	loginPage.verifyTitle();
	loginPage.verifyLoginText();
});

Then('User can see register link', () => {
	registerPage.registerLinkVisible();
});

When('User can click on register link', () => {
	registerPage.clickRegisterLink(0);
});

Then('User can enter full name', () => {
	registerPage.enterFullName(fullName);
});

And('User can enter email address', () => {
	registerPage.enterEmail(email);
});

And('User can enter password', () => {
	registerPage.enterPassword(pass);
});

And('User can repeat password', () => {
	registerPage.enterConfirmPass(pass);
});

And('User can click on terms and conditions checkbox', () => {
	registerPage.clickTermAndConditionCheckBox();
});

When('User click on click on register button', () => {
	registerPage.clickRegisterButton();
});

// Create first organization
Then(
	'User will be redirected to create first organization and add organization name',
	() => {
		onboardingPage.enterOrganizationName(organizationName);
	}
);

And('User can select currency', () => {
	onboardingPage.selectCurrency(OnboardingPageData.currency);
});

And('User can enter organization official name', () => {
	onboardingPage.enterOfficialName(organizationName);
});

And('User can enter tax id', () => {
	onboardingPage.enterTaxId(taxId);
});

When('User click on next button', () => {
	registerPage.clickOnNextButton();
});

Then('User can see country dropdown', () => {
	registerPage.countryDropdownVisible();
});

When('User click on country dropdown', () => {
	registerPage.clickCountryDropdown();
});

Then('User can select country from dropdown options', () => {
	registerPage.selectCountryFromDropdown(RegisterPageData.country);
});

And('User can see city input field', () => {
	registerPage.cityInputVisible();
});

And('User can enter value for city', () => {
	registerPage.enterCityInputData(RegisterPageData.city);
});

And('User can see postcode input field', () => {
	registerPage.postcodeInputVisible();
});

And('User can enter value for postcode', () => {
	registerPage.enterPostcodeInputData(RegisterPageData.postcode);
});

And('User can see street input field', () => {
	registerPage.streetInputVisible();
});

And('User can enter value for street', () => {
	registerPage.enterStreetInputData(street);
});

When('User click on next button', () => {
	registerPage.clickOnNextButton();
});

Then('User can see bonus type dropdown', () => {
	registerPage.bonusTypeDropdownVisible();
});

When('User click on bonus type dropdown', () => {
	registerPage.clickBonusTypeDropdown();
});

Then('User can select bonus type from dropdown options', () => {
	registerPage.selectBonusTypeFromDropdown(RegisterPageData.bonusType);
});

And('User can see bonus percentage input field', () => {
	registerPage.bonusPercentageInputVisible();
});

And('User can enter bonus percentage data', () => {
	registerPage.enterBonusPercentageInputData(
		RegisterPageData.bonusPercentage
	);
});

When('User click on next button', () => {
	registerPage.clickOnNextButton();
});

Then('User can see timezone dropdown', () => {
	registerPage.timeZoneDropdownVisible();
});

When('User click on timezone dropdown', () => {
	registerPage.clickTimeZoneDropdown();
});

Then('User can select timezone from dropdown options', () => {
	registerPage.selectTimeZoneFromDropdown(RegisterPageData.timeZone);
});

And('User can see start of week dropdown', () => {
	registerPage.startOfWeekDropdownVisible();
});

When('User click on start week dropdown', () => {
	registerPage.clickStartOfWeekDropdown();
});

Then('User can select start of week option', () => {
	registerPage.selectStartOfWeekFromDropdown(RegisterPageData.startOfWeek);
});

And('User can see date type dropdown', () => {
	registerPage.dateTypeDropdownVisible();
});

When('User click on date type dropdown', () => {
	registerPage.clickDateTypeDropdown();
});

Then('User can select date type from dropdown', () => {
	registerPage.selectDateTypeFromDropdown(RegisterPageData.dateType);
});

And('User can see region dropdown', () => {
	registerPage.regionDropdownVisible();
});

When('User click on region dropdown', () => {
	registerPage.clickRegionDropdown();
});

Then('User can select region from dropdown', () => {
	registerPage.selectRegionFromDropdown(RegisterPageData.region);
});

And('User can see number format dropdown', () => {
	registerPage.numberFormatDropdownVisible();
});

When('User click on number format dropdown', () => {
	registerPage.clickNumberFormatDropdown();
});

Then('User can select number format from dropdown', () => {
	registerPage.selectNumberFormatFromDropdown(RegisterPageData.numberFormat);
});

And('User can see date format dropdown', () => {
	registerPage.dateFormatDropdownVisible();
});

When('User click on date format dropdown', () => {
	registerPage.clickDateFormatDropdown();
});

Then('User can select date format from dropdown', () => {
	registerPage.selectDateFormatFromDropdown();
});

And('User can see expiry period input field', () => {
	registerPage.expiryPeriodInputVisible();
});

And('User can enter value for expiry period', () => {
	registerPage.enterExpiryPeriodInputData(RegisterPageData.expiryPeriod);
});

When('User click on next button', () => {
	registerPage.clickOnNextButton();
});

Then('User can verify complete page', () => {
	cy.on('uncaught:exception', (err, runnable) => {
		return false;
	});
	onboardingPage.verifyHeadingOnCompletePage();
});

When('User click on dashboard', () => {
	onboardingPage.clickDashboardCard(0);
});

Then('User can see home page as authorized user', () => {
	dashboradPage.verifyCreateButton();
});

// Logout
When('User click on username', () => {
	dashboradPage.clickUserName();
});

Then('User can click on logout button', () => {
	logoutPage.clickLogoutButton();
});

And('User can see login page', () => {
	loginPage.verifyLoginText();
});

// Login with same credentials
And('User can see login button', () => {
	loginPage.verifyLoginButton();
});

And('User can see email input field', () => {
	loginPage.clearEmailField();
});

And('User can enter value for email', () => {
	loginPage.enterEmail(email);
});

And('User can see password input field', () => {
	loginPage.clearPasswordField();
});

And('User can enter value for password', () => {
	loginPage.enterPassword(pass);
});

When('User click on login button', () => {
	loginPage.clickLoginButton();
});

Then('User will be redirected to home page as authorized user', () => {
	registerPage.verifyLogoExists();
});
