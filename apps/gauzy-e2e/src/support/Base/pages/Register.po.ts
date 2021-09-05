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
} from '../utils/util';
import { RegisterPage } from '../pageobjects/RegisterPageObject';

export const registerLinkVisible = () => {
	verifyElementIsVisible(RegisterPage.registerLinkCss);
};

export const clickRegisterLink = (index) => {
	clickButtonByIndex(RegisterPage.registerLinkCss, index);
};

export const enterFullName = (data) => {
	enterInput(RegisterPage.fullNameFieldCss, data);
};

export const enterEmail = (data) => {
	enterInput(RegisterPage.emailAddressFieldCss, data);
};

export const enterPassword = (data) => {
	enterInput(RegisterPage.passwordFieldCss, data);
};

export const enterConfirmPass = (data) => {
	enterInput(RegisterPage.confirmPassFieldCss, data);
};

export const clickTermAndConditionCheckBox = () => {
	clickButton(RegisterPage.termAndConditionCheckboxCss);
};

export const clickRegisterButton = () => {
	clickButton(RegisterPage.registerButtonCss);
};

export const verifyOrganisationNameField = () => {
	verifyElementIsVisible(RegisterPage.organisationNameFieldCss);
};

export const enterOrganizationName = (data) => {
	enterInput(RegisterPage.organisationNameFieldCss, data);
};

export const selectCurrency = (data) => {
	clickButton(RegisterPage.currencyFieldCss);
	clickElementByText(RegisterPage.dropdownOptionCss, data);
};

export const enterOfficialName = (data) => {
	enterInput(RegisterPage.officialNameFieldCss, data);
};

export const enterTaxId = (data) => {
	enterInput(RegisterPage.taxFieldCss, data);
};

export const clickOnNextButton = () => {
	clickButton(RegisterPage.nextButtonCss);
};

export const verifyOrganizationExists = (text) => {
	verifyText(RegisterPage.verifyOrganizationCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(RegisterPage.toastrMessageCss);
};

export const countryDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.countryDropdownCss);
};

export const clickCountryDropdown = () => {
	clickButton(RegisterPage.countryDropdownCss);
};

export const selectCountryFromDropdown = (text) => {
	clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(RegisterPage.cityInputCss);
};

export const enterCityInputData = (data) => {
	clearField(RegisterPage.cityInputCss);
	enterInput(RegisterPage.cityInputCss, data);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(RegisterPage.postcodeInputCss);
};

export const enterPostcodeInputData = (data) => {
	clearField(RegisterPage.postcodeInputCss);
	enterInput(RegisterPage.postcodeInputCss, data);
};

export const streetInputVisible = () => {
	verifyElementIsVisible(RegisterPage.streetInputCss);
};

export const enterStreetInputData = (data) => {
	clearField(RegisterPage.streetInputCss);
	enterInput(RegisterPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = () => {
	clickButton(RegisterPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = (text) => {
	clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const bonusPercentageInputVisible = () => {
	verifyElementIsVisible(RegisterPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = (data) => {
	clearField(RegisterPage.bonusPercentageCss);
	enterInput(RegisterPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = () => {
	verifyElementIsVisible(RegisterPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = (data) => {
	clearField(RegisterPage.expiryPeriodInputCss);
	enterInput(RegisterPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.timeZoneDropdownCss);
};

export const clickTimeZoneDropdown = () => {
	clickButton(RegisterPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = (text) => {
	clickElementByText(RegisterPage.timeZoneDropdownOptionCss, text);
};

export const startOfWeekDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = () => {
	clickButton(RegisterPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = (text) => {
	clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const dateTypeDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = () => {
	clickButton(RegisterPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = (text) => {
	clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const regionDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = () => {
	clickButton(RegisterPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = (text) => {
	clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const numberFormatDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = () => {
	clickButton(RegisterPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = (text) => {
	clickElementByText(RegisterPage.dropdownOptionCss, text);
};

export const dateFormatDropdownVisible = () => {
	verifyElementIsVisible(RegisterPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = () => {
	clickButton(RegisterPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = () => {
	const today = dayjs().format('MM/DD/YYYY');
	clickElementByText(RegisterPage.dropdownOptionCss, today);
};

export const selectTableRow = () => {
	getLastElement(RegisterPage.tableRowCss);
};

export const verifyLogoExists = () => {
	verifyElementIsVisible(RegisterPage.verifyLogoCss);
};
