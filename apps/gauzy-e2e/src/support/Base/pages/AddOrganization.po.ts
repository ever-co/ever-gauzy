import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText,
	waitElementToHide,
	clearField,
	getLastElement
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
	clickElementByText(AddOrganizationPage.dropdownOptionCss, data);
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

export const verifyOrganizationExists = (text) => {
	verifyText(AddOrganizationPage.verifyOrganizationCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(AddOrganizationPage.toastrMessageCss);
};

export const countryDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.countryDropdownCss);
};

export const clickCountryDropdown = () => {
	clickButton(AddOrganizationPage.countryDropdownCss);
};

export const selectCountryFromDropdown = (text) => {
	clickElementByText(AddOrganizationPage.dropdownOptionCss, text);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.cityInputCss);
};

export const enterCityInputData = (data) => {
	clearField(AddOrganizationPage.cityInputCss);
	enterInput(AddOrganizationPage.cityInputCss, data);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.postcodeInputCss);
};

export const enterPostcodeInputData = (data) => {
	clearField(AddOrganizationPage.postcodeInputCss);
	enterInput(AddOrganizationPage.postcodeInputCss, data);
};

export const bonusTypeDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = () => {
	clickButton(AddOrganizationPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = (text) => {
	clickElementByText(AddOrganizationPage.dropdownOptionCss, text);
};

export const bonusPercentageInputVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = (data) => {
	clearField(AddOrganizationPage.bonusPercentageCss);
	enterInput(AddOrganizationPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = (data) => {
	clearField(AddOrganizationPage.expiryPeriodInputCss);
	enterInput(AddOrganizationPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.timeZoneDropdownCss);
};

export const clickTimeZoneDropdown = () => {
	clickButton(AddOrganizationPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = (text) => {
	clickElementByText(AddOrganizationPage.timeZoneDropdownOptionCss, text);
};

export const startOfWeekDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = () => {
	clickButton(AddOrganizationPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = (text) => {
	clickElementByText(AddOrganizationPage.dropdownOptionCss, text);
};

export const dateTypeDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = () => {
	clickButton(AddOrganizationPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = (text) => {
	clickElementByText(AddOrganizationPage.dropdownOptionCss, text);
};

export const regionDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = () => {
	clickButton(AddOrganizationPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = (text) => {
	clickElementByText(AddOrganizationPage.dropdownOptionCss, text);
};

export const numberFormatDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = () => {
	clickButton(AddOrganizationPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = (text) => {
	clickElementByText(AddOrganizationPage.dropdownOptionCss, text);
};

export const dateFormatDropdownVisible = () => {
	verifyElementIsVisible(AddOrganizationPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = () => {
	clickButton(AddOrganizationPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = () => {
	const today = Cypress.moment().format('MM/DD/YYYY');
	clickElementByText(AddOrganizationPage.dropdownOptionCss, today);
};

export const selectTableRow = () => {
	getLastElement(AddOrganizationPage.tableRowCss);
};
