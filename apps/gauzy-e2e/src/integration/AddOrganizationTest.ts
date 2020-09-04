import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addOrganizationPage from '../support/Base/pages/AddOrganization.po';
import * as faker from 'faker';
import { AddOrganizationPageData } from '../support/Base/pagedata/AddOrganizationPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';

let fullName = ' ';
let email = ' ';
let pass = ' ';
let organizationName = ' ';
let taxId = ' ';

describe('Create Organization Test', () => {
	before(() => {
		fullName = faker.name.findName();
		email = faker.internet.email();
		pass = faker.internet.password();
		organizationName = faker.company.companyName();
		taxId = faker.random.alphaNumeric();

		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should able to create organization', () => {
		cy.visit('/#/pages/organizations');
		addOrganizationPage.addBtnExists();
		addOrganizationPage.addBtnClick();
		addOrganizationPage.enterOrganizationName(organizationName);
		addOrganizationPage.selectCurrency(AddOrganizationPageData.currency);
		addOrganizationPage.enterOfficialName(organizationName);
		addOrganizationPage.enterTaxId(taxId);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.clickOnNextButton();
	});
});
