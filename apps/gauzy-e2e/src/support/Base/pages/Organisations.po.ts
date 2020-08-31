import { enterInput, verifyElementIsVisible, clickButton } from '../utils/util';

import { OrganisationsPageObject } from '../pageobjects/OrganisationsPageObject';

export const verifyBtnAddOrganisationExist = () => {
	verifyElementIsVisible(OrganisationsPageObject.btnAddOrganisationSelector);
};

export const clickBtnAddOrganisation = () => {
	clickButton(OrganisationsPageObject.btnAddOrganisationSelector);
};

export const verifyInputOrganisationNameExist = () => {
	verifyElementIsVisible(
		OrganisationsPageObject.inputOrganisationNameSelector
	);
};

export const typeOrganisationName = () => {
	const organisationName = 'Organisation Name';
	cy.get(OrganisationsPageObject.inputOrganisationNameSelector)
		.type(organisationName)
		.should('have.value', organisationName);
};

export const selectOrganisationCurrency = () => {
	verifyElementIsVisible(
		OrganisationsPageObject.inputOrganisationCurrencySelector
	);
	cy.get(OrganisationsPageObject.inputOrganisationCurrencySelector).click();

	verifyElementIsVisible(
		OrganisationsPageObject.inputOrganisationCurrencyOptionSelector
	);
	cy.get(
		OrganisationsPageObject.inputOrganisationCurrencyOptionSelector
	).click();

	verifyElementIsVisible(OrganisationsPageObject.btnNextAddOrganisationStep1);
	cy.get(OrganisationsPageObject.btnNextAddOrganisationStep1).click();

	verifyElementIsVisible(OrganisationsPageObject.btnNextAddOrganisationStep2);
	cy.get(OrganisationsPageObject.btnNextAddOrganisationStep2).click();

	verifyElementIsVisible(OrganisationsPageObject.btnNextAddOrganisationStep3);
	cy.get(OrganisationsPageObject.btnNextAddOrganisationStep3).click();

	verifyElementIsVisible(OrganisationsPageObject.btnNextAddOrganisationStep4);
	cy.get(OrganisationsPageObject.btnNextAddOrganisationStep4).click();

	// verifyElementIsVisible(OrganisationsPageObject.btnNextAddOrganisationStep4);
};
