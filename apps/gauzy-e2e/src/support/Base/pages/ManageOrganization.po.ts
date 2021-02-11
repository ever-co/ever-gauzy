import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText,
	waitElementToHide,
	clearField,
	getLastElement,
	clickButtonByIndex,
	scrollDown
} from '../utils/util';
import { ManageOrganizationPage } from '../pageobjects/ManageOrganizationPageObject';

export const gridBtnExists = () => {
	verifyElementIsVisible(ManageOrganizationPage.gridButtonCss);
};

export const gridBtnClick = (index) => {
	clickButtonByIndex(ManageOrganizationPage.gridButtonCss, index);
};

export const manageBtnExists = () => {
	verifyElementIsVisible(ManageOrganizationPage.manageButtonCss);
};

export const manageBtnClick = () => {
	clickButton(ManageOrganizationPage.manageButtonCss);
};

export const verifyOrganisationNameField = () => {
	verifyElementIsVisible(ManageOrganizationPage.organisationNameFieldCss);
};

export const enterOrganizationName = (data) => {
	enterInput(ManageOrganizationPage.organisationNameFieldCss, data);
};

export const selectCurrency = (data) => {
	clickButton(ManageOrganizationPage.currencyFieldCss);
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, data);
};

export const enterOfficialName = (data) => {
	enterInput(ManageOrganizationPage.officialNameFieldCss, data);
};

export const enterTaxId = (data) => {
	enterInput(ManageOrganizationPage.taxFieldCss, data);
};

export const tabButtonVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.tabButtonCss);
};

export const clickTabButton = (index) => {
	clickButtonByIndex(ManageOrganizationPage.tabButtonCss, index);
};

export const scrollDownBody = () => {
	scrollDown(ManageOrganizationPage.cardBodyCss);
};

export const verifyOrganizationExists = (text) => {
	verifyText(ManageOrganizationPage.verifyOrganizationCss, text);
};

export const waitMessageToHide = () => {
	waitElementToHide(ManageOrganizationPage.toastrMessageCss);
};

export const countryDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.countryDropdownCss);
};

export const clickCountryDropdown = () => {
	clickButton(ManageOrganizationPage.countryDropdownCss);
};

export const selectCountryFromDropdown = (text) => {
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);
};

export const cityInputVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.cityInputCss);
};

export const enterCityInputData = (data) => {
	clearField(ManageOrganizationPage.cityInputCss);
	enterInput(ManageOrganizationPage.cityInputCss, data);
};

export const postcodeInputVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.postcodeInputCss);
};

export const enterPostcodeInputData = (data) => {
	clearField(ManageOrganizationPage.postcodeInputCss);
	enterInput(ManageOrganizationPage.postcodeInputCss, data);
};

export const streetInputVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.streetInputCss);
};

export const enterStreetInputData = (data) => {
	clearField(ManageOrganizationPage.streetInputCss);
	enterInput(ManageOrganizationPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = () => {
	clickButton(ManageOrganizationPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = (text) => {
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);
};

export const bonusPercentageInputVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = (data) => {
	clearField(ManageOrganizationPage.bonusPercentageCss);
	enterInput(ManageOrganizationPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = (data) => {
	clearField(ManageOrganizationPage.expiryPeriodInputCss);
	enterInput(ManageOrganizationPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.timeZoneDropdownCss);
};

export const clickTimeZoneDropdown = () => {
	clickButton(ManageOrganizationPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = (text) => {
	clickElementByText(ManageOrganizationPage.timeZoneDropdownOptionCss, text);
};

export const startOfWeekDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = () => {
	clickButton(ManageOrganizationPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = (text) => {
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);
};

export const dateTypeDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = () => {
	clickButton(ManageOrganizationPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = (text) => {
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);
};

export const regionDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = () => {
	clickButton(ManageOrganizationPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = (text) => {
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);
};

export const numberFormatDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = () => {
	clickButton(ManageOrganizationPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = (text) => {
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);
};

export const dateFormatDropdownVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = () => {
	clickButton(ManageOrganizationPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = () => {
	const today = Cypress.moment().format('MM/DD/YYYY');
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, today);
};

export const saveButtonVisible = () => {
	verifyElementIsVisible(ManageOrganizationPage.saveButtonCss);
};

export const clickSaveButton = () => {
	clickButton(ManageOrganizationPage.saveButtonCss);
};

export const selectTableRow = () => {
	getLastElement(ManageOrganizationPage.tableRowCss);
};
