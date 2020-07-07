import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clickButtonByIndex
} from '../utils/util';
import { OnboardingPage } from '../pageobjects/OnboardingPageObject';
export const verifyOrganisationNameField = () => {
	verifyElementIsVisible(OnboardingPage.organisationNameFieldCss);
};

export const enterOrganizationName = (data) => {
	enterInput(OnboardingPage.organisationNameFieldCss, data);
};

export const selectCurrency = (data) => {
	clickButton(OnboardingPage.currencyFieldCss);
	clickElementByText(OnboardingPage.currencyOptionCss, data);
};

export const enterOfficialName = (data) => {
	enterInput(OnboardingPage.officialNameFieldCss, data);
};

export const enterTaxId = (data) => {
	enterInput(OnboardingPage.taxFieldCss, data);
};

export const clickOnNextButton = () => {
	clickButton(OnboardingPage.nextButtonCss);
};

export const clickDashboardCard = (data) => {
	clickButtonByIndex(OnboardingPage.gotoDashboardCardCss, data);
};

export const verifyHeadingOnCompletePage = () => {
	verifyElementIsVisible(OnboardingPage.completePageHeadingCss);
};
