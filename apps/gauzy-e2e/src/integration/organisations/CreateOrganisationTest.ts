import * as loginPage from '../../support/Base/pages/Login.po';
import * as dashboradPage from '../../support/Base/pages/Dashboard.po';
import * as organisationsPage from '../../support/Base/pages/Organisations.po';

import { LoginPageData } from '../../support/Base/pagedata/LoginPageData';

import * as faker from 'faker';

describe('Create organisation', () => {
	before(() => {
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

	it('Should create a new organization', () => {
		cy.visit('/pages/organizations');
		organisationsPage.verifyBtnAddOrganisationExist();
		organisationsPage.clickBtnAddOrganisation();
		organisationsPage.typeOrganisationName();
		organisationsPage.selectOrganisationCurrency();
	});

	it('Should delete the newly created organization', () => {});
});
