import { enterInput, verifyElementIsVisible, clickButton, clickElementByText, clickButtonByIndex } from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OnboardingPage } from '../../../src/support/Base/pageobjects/OnboardingPageObject';

export const verifyOrganisationNameField = async () => verifyElementIsVisible(OnboardingPage.organizationNameFieldCss);

export const enterOrganizationName = async (data: string) => enterInput(OnboardingPage.organizationNameFieldCss, data);

export const selectCurrency = async (data: string) => {
	await clickButton(OnboardingPage.currencyFieldCss);
	await clickElementByText(OnboardingPage.currencyOptionCss, data);
};

export const enterOfficialName = async (data: string) => enterInput(OnboardingPage.officialNameFieldCss, data);

export const enterTaxId = async (data: string) => enterInput(OnboardingPage.taxFieldCss, data);

export const clickOnNextButton = async () => clickButton(OnboardingPage.nextButtonCss);

export const clickDashboardCard = async (data: number) => clickButtonByIndex(OnboardingPage.gotoDashboardCardCss, data);

export const verifyHeadingOnCompletePage = async () => verifyElementIsVisible(OnboardingPage.completePageHeadingCss);
