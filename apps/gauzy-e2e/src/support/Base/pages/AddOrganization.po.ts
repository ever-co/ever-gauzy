import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText
} from '../utils/util';
import { AddOrganizationPage } from '../pageobjects/AddOrganizationPageObject';

export const addBtnExists = () => {
	verifyElementIsVisible(AddOrganizationPage.addButtonCss);
};

export const addBtnClick = () => {
	clickButton(AddOrganizationPage.addButtonCss);
};

export const verifyOrganisationNameField = () => {
	verifyElementIsVisible(AddOrganizationPage.organisationNameFieldCss);
};

export const enterOrganizationName = (data) => {
	enterInput(AddOrganizationPage.organisationNameFieldCss, data);
};

export const selectCurrency = (data) => {
	clickButton(AddOrganizationPage.currencyFieldCss);
	clickElementByText(AddOrganizationPage.currencyOptionCss, data);
};

export const enterOfficialName = (data) => {
	enterInput(AddOrganizationPage.officialNameFieldCss, data);
};

export const enterTaxId = (data) => {
	enterInput(AddOrganizationPage.taxFieldCss, data);
};

export const clickOnNextButton = () => {
	clickButton(AddOrganizationPage.nextButtonCss);
};
