import * as registerPage from '../support/Base/pages/Register.po';
import * as loginPage from '../support/Base/pages/Login.po';
import * as faker from 'faker';

let fullName = ' ';
let email = ' ';
let pass = ' ';
describe('Register Test', () => {
	before(() => {
		fullName = faker.name.findName();
		email = faker.internet.email();
		pass = faker.internet.password();

		cy.visit('/');
		loginPage.verifyTitle();
	});

	it('Should able to create new account', () => {
		loginPage.verfyLoginText();
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
		registerPage.verifyOrganisationNameField();
	});
});
