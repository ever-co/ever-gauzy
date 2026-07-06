import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as registerPage from '../../support/pages/Register.po';
import * as loginPage from '../../support/pages/Login.po';
import * as onboardingPage from '../../support/pages/Onboarding.po';
import { faker } from '@faker-js/faker';
import { OnboardingPageData } from '../../../src/support/Base/pagedata/OnboardingPageData';
import * as dashboardPage from '../../support/pages/Dashboard.po';
import * as logoutPage from '../../support/pages/Logout.po';
import { RegisterPageData } from '../../../src/support/Base/pagedata/RegisterPageData';

// Converted 1:1 from the plain RegisterTest.spec.ts: this flow self-registers (no shared login
// Background), so the pre-step preamble (faker data + goto('/') + verifyTitle) runs at the start of
// the first step's body, and each test.step() becomes one When step with its verbatim .po call
// sequence. `email`/`pass` are generated in the first step and reused in the final login step, so the
// faker-generated values live at module scope (one scenario per feature => no cross-scenario bleed).

let fullName = ' ';
let email = ' ';
let pass = ' ';
let organizationName = ' ';
let taxId = ' ';
let street = ' ';

When('I create a new account', async () => {
	fullName = faker.person.fullName();
	email = faker.internet.exampleEmail();
	pass = faker.internet.password();
	organizationName = faker.company.name();
	taxId = faker.string.alphanumeric();
	street = faker.location.streetAddress();

	await getPage().goto('/');
	await loginPage.verifyTitle();

	await loginPage.verifyLoginText();
	await registerPage.clickRegisterLink(0);
	await registerPage.enterFullName(fullName);
	await registerPage.enterEmail(email);
	await registerPage.enterPassword(pass);
	await registerPage.enterConfirmPass(pass);
	await registerPage.clickTermAndConditionCheckBox();
	await registerPage.clickRegisterButton();
});

When('I create my first organization', async () => {
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

When('I log out of the newly registered account', async () => {
	await dashboardPage.clickUserName();
	await logoutPage.clickLogoutButton();
	await loginPage.verifyLoginText();
});

When('I log in with the newly registered credentials', async () => {
	await loginPage.verifyLoginButton();
	await loginPage.clearEmailField();
	await loginPage.enterEmail(email);
	await loginPage.clearPasswordField();
	await loginPage.enterPassword(pass);
	await loginPage.clickLoginButton();
	await registerPage.verifyLogoExists();
});
