import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as registerPage from './support/pages/Register.po';
import * as loginPage from './support/pages/Login.po';
import * as onboardingPage from './support/pages/Onboarding.po';
import { faker } from '@faker-js/faker';
import { OnboardingPageData } from '../src/support/Base/pagedata/OnboardingPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as logoutPage from './support/pages/Logout.po';
import { RegisterPageData } from '../src/support/Base/pagedata/RegisterPageData';

let fullName = ' ';
let email = ' ';
let pass = ' ';
let organizationName = ' ';
let taxId = ' ';
let street = ' ';

test.describe('Register Test', () => {
	test('Register Test', async () => {
		fullName = faker.person.fullName();
		email = faker.internet.exampleEmail();
		pass = faker.internet.password();
		organizationName = faker.company.name();
		taxId = faker.string.alphanumeric();
		street = faker.location.streetAddress();

		await getPage().goto('/');
		await loginPage.verifyTitle();

		await test.step('Should able to create new account', async () => {
			await loginPage.verifyLoginText();
			await registerPage.clickRegisterLink(0);
			await registerPage.enterFullName(fullName);
			await registerPage.enterEmail(email);
			await registerPage.enterPassword(pass);
			await registerPage.enterConfirmPass(pass);
			await registerPage.clickTermAndConditionCheckBox();
			await registerPage.clickRegisterButton();
		});

		await test.step('Should able to create first organization', async () => {
			await onboardingPage.enterOrganizationName(organizationName);
			await onboardingPage.selectCurrency(OnboardingPageData.currency);
			await onboardingPage.enterOfficialName(organizationName);
			await onboardingPage.enterTaxId(taxId);
			await registerPage.clickOnNextButton();
			await registerPage.countryDropdownVisible();
			await registerPage.clickCountryDropdown();
			await registerPage.selectCountryFromDropdown(RegisterPageData.country);
			await registerPage.cityInputVisible();
			await registerPage.enterCityInputData(RegisterPageData.city);
			await registerPage.postcodeInputVisible();
			await registerPage.enterPostcodeInputData(RegisterPageData.postcode);
			await registerPage.streetInputVisible();
			await registerPage.enterStreetInputData(street);
			await registerPage.clickOnNextButton();
			await registerPage.bonusTypeDropdownVisible();
			await registerPage.clickBonusTypeDropdown();
			await registerPage.selectBonusTypeFromDropdown(RegisterPageData.bonusType);
			await registerPage.bonusPercentageInputVisible();
			await registerPage.enterBonusPercentageInputData(
				RegisterPageData.bonusPercentage
			);
			await registerPage.clickOnNextButton();
			await registerPage.timeZoneDropdownVisible();
			await registerPage.clickTimeZoneDropdown();
			await registerPage.selectTimeZoneFromDropdown(RegisterPageData.timeZone);
			await registerPage.startOfWeekDropdownVisible();
			await registerPage.clickStartOfWeekDropdown();
			await registerPage.selectStartOfWeekFromDropdown(
				RegisterPageData.startOfWeek
			);
			await registerPage.dateTypeDropdownVisible();
			await registerPage.clickDateTypeDropdown();
			await registerPage.selectDateTypeFromDropdown(RegisterPageData.dateType);
			await registerPage.regionDropdownVisible();
			await registerPage.clickRegionDropdown();
			await registerPage.selectRegionFromDropdown(RegisterPageData.region);
			await registerPage.numberFormatDropdownVisible();
			await registerPage.clickNumberFormatDropdown();
			await registerPage.selectNumberFormatFromDropdown(
				RegisterPageData.numberFormat
			);
			await registerPage.dateFormatDropdownVisible();
			await registerPage.clickDateFormatDropdown();
			await registerPage.selectDateFormatFromDropdown();
			await registerPage.expiryPeriodInputVisible();
			await registerPage.enterExpiryPeriodInputData(RegisterPageData.expiryPeriod);
			await registerPage.clickOnNextButton();
			// The current onboarding stepper has a 5th step ("Register as Employee") that the
			// original 4-step Cypress flow predates; its "Add" submit completes onboarding.
			await registerPage.clickFinishButton();
			await onboardingPage.verifyHeadingOnCompletePage();
			await onboardingPage.clickDashboardCard(0);
			await dashboardPage.verifyCreateButton();
		});

		await test.step('Should able to logout', async () => {
			await dashboardPage.clickUserName();
			await logoutPage.clickLogoutButton();
			await loginPage.verifyLoginText();
		});

		await test.step('Should able to login with same credentials', async () => {
			await loginPage.verifyLoginButton();
			await loginPage.clearEmailField();
			await loginPage.enterEmail(email);
			await loginPage.clearPasswordField();
			await loginPage.enterPassword(pass);
			await loginPage.clickLoginButton();
			await registerPage.verifyLogoExists();
		});
	});
});
