import dayjs from 'dayjs';
import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	verifyText,
	waitElementToHide,
	clearField,
	getLastElement,
	clickButtonByIndex
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { AddOrganizationPage } from '../../../src/support/Base/pageobjects/AddOrganizationPageObject';

export const gridBtnExists = async () => {
	await verifyElementIsVisible(AddOrganizationPage.gridButtonCss);
};

export const gridBtnClick = async (index: number) => {
	await clickButtonByIndex(AddOrganizationPage.gridButtonCss, index);
};

export const addBtnExists = async () => {
	await verifyElementIsVisible(AddOrganizationPage.addButtonCss);
};

export const addBtnClick = async () => {
	await clickButton(AddOrganizationPage.addButtonCss);
};

export const verifyOrganisationNameField = async () => {
	await verifyElementIsVisible(AddOrganizationPage.organizationNameFieldCss);
};

export const enterOrganizationName = async (data: string) => {
	await clearField(AddOrganizationPage.organizationNameFieldCss);
	await enterInput(AddOrganizationPage.organizationNameFieldCss, data);
};

export const selectCurrency = async (data: string) => {
	await clickButton(AddOrganizationPage.currencyFieldCss);
	await clickElementByText(AddOrganizationPage.dropdownOptionCss, data);
};

export const enterOfficialName = async (data: string) => {
	await enterInput(AddOrganizationPage.officialNameFieldCss, data);
};

export const enterTaxId = async (data: string) => {
	await enterInput(AddOrganizationPage.taxFieldCss, data);
};

export const clickOnNextButton = async () => {
	await clickButton(AddOrganizationPage.nextButtonCss);
};

export const verifyOrganizationExists = async (text: string) => {
	await verifyText(AddOrganizationPage.verifyOrganizationCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(AddOrganizationPage.toastrMessageCss);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(AddOrganizationPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text: string) => {
	await clickElementByText(AddOrganizationPage.dropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.cityInputCss);
};

export const enterCityInputData = async (data: string) => {
	await clearField(AddOrganizationPage.cityInputCss);
	await enterInput(AddOrganizationPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data: string) => {
	await clearField(AddOrganizationPage.postCodeInputCss);
	await enterInput(AddOrganizationPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.streetInputCss);
};

export const enterStreetInputData = async (data: string) => {
	await clearField(AddOrganizationPage.streetInputCss);
	await enterInput(AddOrganizationPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = async () => {
	await clickButton(AddOrganizationPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = async (text: string) => {
	await clickElementByText(AddOrganizationPage.bonusDropdownOptionCss, text);
};

export const bonusPercentageInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = async (data: string) => {
	await clearField(AddOrganizationPage.bonusPercentageCss);
	await enterInput(AddOrganizationPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = async (data: string) => {
	await clearField(AddOrganizationPage.expiryPeriodInputCss);
	await enterInput(AddOrganizationPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.timeZoneDropdownCss);
};

export const clickTimeZoneDropdown = async () => {
	await clickButton(AddOrganizationPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = async (text: string) => {
	await clickElementByText(AddOrganizationPage.timeZoneDropdownOptionCss, text);
};

export const startOfWeekDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = async () => {
	await clickButton(AddOrganizationPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = async (text: string) => {
	await clickElementByText(AddOrganizationPage.startOfWeekOptionCss, text);
};

export const dateTypeDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = async () => {
	await clickButton(AddOrganizationPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = async (text: string) => {
	await clickElementByText(AddOrganizationPage.dateDropdownOptionCss, text);
};

export const regionDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = async () => {
	await clickButton(AddOrganizationPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = async (text: string) => {
	await clickElementByText(AddOrganizationPage.regionDropdownOptionCss, text);
};

export const numberFormatDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = async () => {
	await clickButton(AddOrganizationPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = async (text: string) => {
	await clickElementByText(AddOrganizationPage.numberFormatDropdownOptionCss, text);
};

export const dateFormatDropdownVisible = async () => {
	await verifyElementIsVisible(AddOrganizationPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = async () => {
	await clickButton(AddOrganizationPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = async () => {
	const today = dayjs().format('DD/MM/YYYY');
	await clickElementByText(AddOrganizationPage.dateFormatOptionCss, today);
};

export const selectTableRow = async () => {
	await getLastElement(AddOrganizationPage.tableRowCss);
};
