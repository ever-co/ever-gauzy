import * as registerPage from '../support/Base/pages/Register.po';
import * as loginPage from '../support/Base/pages/Login.po';
import * as onboardingPage from '../support/Base/pages/Onboarding.po';
import * as faker from 'faker';
import { OnboardingPageData } from '../support/Base/pagedata/OnboardingPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as logoutPage from '../support/Base/pages/Logout.po';

let fullName = ' ';
let email = ' ';
let pass = ' ';
let organizationName = ' ';
let taxId = ' ';
describe('Register Test', () => {
	before(() => {
		fullName = faker.name.findName();
		email = faker.internet.email();
		pass = faker.internet.password();
		organizationName = faker.company.companyName();
		taxId = faker.random.alphaNumeric();

		cy.visit('/');
		loginPage.verifyTitle();
	});

	it('Should able to create new account', () => {
		loginPage.verifyLoginText();
		registerPage.clickRegisterLink();
		registerPage.enterFullName(fullName);
		registerPage.enterEmail(email);
		registerPage.enterPassword(pass);
		registerPage.enterConfirmPass(pass);
		registerPage.clickTermAndConditionCheckBox();
		registerPage.clickRegisterButton();
	});

	it('Should able to login with same credentials', () => {
		loginPage.verifyLoginButton();
		loginPage.clearEmailField();
		loginPage.enterEmail(email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(pass);
		loginPage.clickLoginButton();
		onboardingPage.verifyOrganisationNameField();
	});

	it('Should able to create first organisation', () => {
		onboardingPage.enterOrganizationName(organizationName);
		onboardingPage.selectCurrency(OnboardingPageData.currency);
		onboardingPage.enterOfficialName(organizationName);
		onboardingPage.enterTaxId(taxId);
		onboardingPage.clickOnNextButton();
		onboardingPage.clickOnNextButton();
		onboardingPage.clickOnNextButton();
		onboardingPage.clickOnNextButton();
		onboardingPage.verifyHeadingOnCompletePage();
		onboardingPage.clickDashboardCard(0);
		dashboradPage.verifyCreateButton();
	});

	it('Should able to logout', () => {
		dashboradPage.clickUserName();
		logoutPage.clickLogoutButton();
		loginPage.verifyLoginText();
	});
});
