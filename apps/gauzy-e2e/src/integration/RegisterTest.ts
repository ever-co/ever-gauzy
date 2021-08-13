import * as registerPage from '../support/Base/pages/Register.po';
import * as loginPage from '../support/Base/pages/Login.po';
import * as onboardingPage from '../support/Base/pages/Onboarding.po';
import * as faker from 'faker';
import { OnboardingPageData } from '../support/Base/pagedata/OnboardingPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as logoutPage from '../support/Base/pages/Logout.po';
import { RegisterPageData } from '../support/Base/pagedata/RegisterPageData';

let fullName = ' ';
let email = ' ';
let pass = ' ';
let organizationName = ' ';
let taxId = ' ';
let street = ' ';

describe('Register Test', () => {
	before(() => {
		fullName = faker.name.findName();
		email = faker.internet.email();
		pass = faker.internet.password();
		organizationName = faker.company.companyName();
		taxId = faker.random.alphaNumeric();
		street = faker.address.streetAddress();

		cy.visit('/');
		loginPage.verifyTitle();
	});

	it('Should able to create new account', () => {
		loginPage.verifyLoginText();
		registerPage.clickRegisterLink(0);
		registerPage.enterFullName(fullName);
		registerPage.enterEmail(email);
		registerPage.enterPassword(pass);
		registerPage.enterConfirmPass(pass);
		registerPage.clickTermAndConditionCheckBox();
		registerPage.clickRegisterButton();
	});

	it('Should able to create first organization', () => {
		onboardingPage.enterOrganizationName(organizationName);
		onboardingPage.selectCurrency(OnboardingPageData.currency);
		onboardingPage.enterOfficialName(organizationName);
		onboardingPage.enterTaxId(taxId);
		registerPage.clickOnNextButton();
		registerPage.countryDropdownVisible();
		registerPage.clickCountryDropdown();
		registerPage.selectCountryFromDropdown(RegisterPageData.country);
		registerPage.cityInputVisible();
		registerPage.enterCityInputData(RegisterPageData.city);
		registerPage.postcodeInputVisible();
		registerPage.enterPostcodeInputData(RegisterPageData.postcode);
		registerPage.streetInputVisible();
		registerPage.enterStreetInputData(street);
		registerPage.clickOnNextButton();
		registerPage.bonusTypeDropdownVisible();
		registerPage.clickBonusTypeDropdown();
		registerPage.selectBonusTypeFromDropdown(RegisterPageData.bonusType);
		registerPage.bonusPercentageInputVisible();
		registerPage.enterBonusPercentageInputData(
			RegisterPageData.bonusPercentage
		);
		registerPage.clickOnNextButton();
		registerPage.timeZoneDropdownVisible();
		registerPage.clickTimeZoneDropdown();
		registerPage.selectTimeZoneFromDropdown(RegisterPageData.timeZone);
		registerPage.startOfWeekDropdownVisible();
		registerPage.clickStartOfWeekDropdown();
		registerPage.selectStartOfWeekFromDropdown(
			RegisterPageData.startOfWeek
		);
		registerPage.dateTypeDropdownVisible();
		registerPage.clickDateTypeDropdown();
		registerPage.selectDateTypeFromDropdown(RegisterPageData.dateType);
		registerPage.regionDropdownVisible();
		registerPage.clickRegionDropdown();
		registerPage.selectRegionFromDropdown(RegisterPageData.region);
		registerPage.numberFormatDropdownVisible();
		registerPage.clickNumberFormatDropdown();
		registerPage.selectNumberFormatFromDropdown(
			RegisterPageData.numberFormat
		);
		registerPage.dateFormatDropdownVisible();
		registerPage.clickDateFormatDropdown();
		registerPage.selectDateFormatFromDropdown();
		registerPage.expiryPeriodInputVisible();
		registerPage.enterExpiryPeriodInputData(RegisterPageData.expiryPeriod);
		registerPage.clickOnNextButton();
		onboardingPage.verifyHeadingOnCompletePage();
		onboardingPage.clickDashboardCard(0);
		dashboradPage.verifyCreateButton();
	});

	it('Should able to logout', () => {
		dashboradPage.clickUserName();
		logoutPage.clickLogoutButton();
		loginPage.verifyLoginText();
	});

	it('Should able to login with same credentials', () => {
		loginPage.verifyLoginButton();
		loginPage.clearEmailField();
		loginPage.enterEmail(email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(pass);
		loginPage.clickLoginButton();
		registerPage.verifyLogoExists();
	});
});
