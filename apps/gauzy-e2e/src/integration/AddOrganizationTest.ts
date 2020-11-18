import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addOrganizationPage from '../support/Base/pages/AddOrganization.po';
import * as faker from 'faker';
import { AddOrganizationPageData } from '../support/Base/pagedata/AddOrganizationPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let organizationName = ' ';
let taxId = ' ';

describe('Create Organization Test', () => {
	before(() => {
		organizationName = faker.company.companyName();
		taxId = faker.random.alphaNumeric();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
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
