import dayjs from 'dayjs';
import {
	clearField,
	clickButton,
	clickButtonByIndex,
	clickElementByText,
	enterInput,
	getLastElement,
	verifyElementIsVisible,
	verifyText,
	waitElementToHide
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RegisterPage } from '../../../src/support/Base/pageobjects/RegisterPageObject';

export const registerLinkVisible = async () => {
	await verifyElementIsVisible(RegisterPage.registerLinkCss);
};

export const clickRegisterLink = async (index) => {
	await clickButtonByIndex(RegisterPage.registerLinkCss, index);
};

export const enterFullName = async (data) => {
	await enterInput(RegisterPage.fullNameFieldCss, data);
};

export const enterEmail = async (data) => {
	await enterInput(RegisterPage.emailAddressFieldCss, data);
};

export const enterPassword = async (data) => {
	await enterInput(RegisterPage.passwordFieldCss, data);
};

export const enterConfirmPass = async (data) => {
	await enterInput(RegisterPage.confirmPassFieldCss, data);
};

export const clickTermAndConditionCheckBox = async () => {
	await clickButton(RegisterPage.termAndConditionCheckboxCss);
};

export const clickRegisterButton = async () => {
	await clickButton(RegisterPage.registerButtonCss);
};

export const verifyOrganisationNameField = async () => {
	await verifyElementIsVisible(RegisterPage.organizationNameFieldCss);
};

export const enterOrganizationName = async (data) => {
	await enterInput(RegisterPage.organizationNameFieldCss, data);
};

export const selectCurrency = async (data) => {
	await clickButton(RegisterPage.currencyFieldCss);
	await clickElementByText(RegisterPage.dropdownOptionCss, data);
};

export const enterOfficialName = async (data) => {
	await enterInput(RegisterPage.officialNameFieldCss, data);
};

export const enterTaxId = async (data) => {
	await enterInput(RegisterPage.taxFieldCss, data);
};

export const clickOnNextButton = async () => {
	await clickButton(RegisterPage.nextButtonCss);
};

export const verifyOrganizationExists = async (text) => {
	await verifyText(RegisterPage.verifyOrganizationCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(RegisterPage.toastrMessageCss);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(RegisterPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text) => {
	await clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.cityInputCss);
};

export const enterCityInputData = async (data) => {
	await clearField(RegisterPage.cityInputCss);
	await enterInput(RegisterPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data) => {
	await clearField(RegisterPage.postCodeInputCss);
	await enterInput(RegisterPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.streetInputCss);
};

export const enterStreetInputData = async (data) => {
	await clearField(RegisterPage.streetInputCss);
	await enterInput(RegisterPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = async () => {
	await clickButton(RegisterPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = async (text) => {
	await clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const bonusPercentageInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = async (data) => {
	await clearField(RegisterPage.bonusPercentageCss);
	await enterInput(RegisterPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = async () => {
	await verifyElementIsVisible(RegisterPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = async (data) => {
	await clearField(RegisterPage.expiryPeriodInputCss);
	await enterInput(RegisterPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.timeZoneDropdownCss);
};

export const clickTimeZoneDropdown = async () => {
	await clickButton(RegisterPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = async (text) => {
	await clickElementByText(RegisterPage.timeZoneDropdownOptionCss, text);
};

export const startOfWeekDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = async () => {
	await clickButton(RegisterPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = async (text) => {
	await clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const dateTypeDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = async () => {
	await clickButton(RegisterPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = async (text) => {
	await clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const regionDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = async () => {
	await clickButton(RegisterPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = async (text) => {
	await clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const numberFormatDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = async () => {
	await clickButton(RegisterPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = async (text) => {
	await clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const dateFormatDropdownVisible = async () => {
	await verifyElementIsVisible(RegisterPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = async () => {
	await clickButton(RegisterPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = async () => {
	const today = dayjs().format('MM/DD/YYYY');
	await clickElementByText(RegisterPage.dropdownOptionCss, today);
};

export const selectTableRow = async () => {
	await getLastElement(RegisterPage.tableRowCss);
};

export const verifyLogoExists = async () => {
	await verifyElementIsVisible(RegisterPage.verifyLogoCss);
};
