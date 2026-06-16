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
	clickButtonByIndex,
	scrollDown
} from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { ManageOrganizationPage } from '../../../src/support/Base/pageobjects/ManageOrganizationPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const manageBtnExists = async () => verifyElementIsVisible(ManageOrganizationPage.manageButtonCss);

export const manageBtnClick = async () => clickButton(ManageOrganizationPage.manageButtonCss);

export const verifyOrganisationNameField = async () =>
	verifyElementIsVisible(ManageOrganizationPage.organizationNameFieldCss);

export const enterOrganizationName = async (data: string) =>
	enterInput(ManageOrganizationPage.organizationNameFieldCss, data);

export const selectCurrency = async (data: string) => {
	await clickButton(ManageOrganizationPage.currencyFieldCss);
	await clickElementByText(ManageOrganizationPage.dropdownOptionCss, data);
};

export const enterOfficialName = async (data: string) => enterInput(ManageOrganizationPage.officialNameFieldCss, data);

export const enterTaxId = async (data: string) => enterInput(ManageOrganizationPage.taxFieldCss, data);

export const tabButtonVisible = async () => verifyElementIsVisible(ManageOrganizationPage.tabButtonCss);

export const clickTabButton = async (index: number) => clickButtonByIndex(ManageOrganizationPage.tabButtonCss, index);

export const scrollDownBody = async () => scrollDown(ManageOrganizationPage.cardBodyCss);

export const verifyOrganizationExists = async (text: string) =>
	verifyText(ManageOrganizationPage.verifyOrganizationCss, text);

export const waitMessageToHide = async () => waitElementToHide(ManageOrganizationPage.toastrMessageCss);

export const countryDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.countryDropdownCss);

export const clickCountryDropdown = async () => clickButton(ManageOrganizationPage.countryDropdownCss);

export const selectCountryFromDropdown = async (text: string) =>
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);

export const cityInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.cityInputCss);

export const enterCityInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.cityInputCss);
	await enterInput(ManageOrganizationPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.postCodeInputCss);

export const enterPostcodeInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.postCodeInputCss);
	await enterInput(ManageOrganizationPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.streetInputCss);

export const enterStreetInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.streetInputCss);
	await enterInput(ManageOrganizationPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.bonusTypeDropdownCss);

export const clickBonusTypeDropdown = async () => clickButton(ManageOrganizationPage.bonusTypeDropdownCss);

export const selectBonusTypeFromDropdown = async (text: string) =>
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);

export const bonusPercentageInputVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.bonusPercentageCss);

export const enterBonusPercentageInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.bonusPercentageCss);
	await enterInput(ManageOrganizationPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = async () => verifyElementIsVisible(ManageOrganizationPage.expiryPeriodInputCss);

export const enterExpiryPeriodInputData = async (data: string) => {
	await clearField(ManageOrganizationPage.expiryPeriodInputCss);
	await enterInput(ManageOrganizationPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.timeZoneDropdownCss);

export const clickTimeZoneDropdown = async () => clickButton(ManageOrganizationPage.timeZoneDropdownCss);

export const selectTimeZoneFromDropdown = async (text: string) =>
	clickElementByText(ManageOrganizationPage.timeZoneDropdownOptionCss, text);

export const startOfWeekDropdownVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.startOfWeekDropdownCss);

export const clickStartOfWeekDropdown = async () => clickButton(ManageOrganizationPage.startOfWeekDropdownCss);

export const selectStartOfWeekFromDropdown = async (text: string) =>
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);

export const dateTypeDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.dateTypeDropdownCss);

export const clickDateTypeDropdown = async () => clickButton(ManageOrganizationPage.dateTypeDropdownCss);

export const selectDateTypeFromDropdown = async (text: string) =>
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);

export const regionDropdownVisible = async () => verifyElementIsVisible(ManageOrganizationPage.regionCodeDropdownCss);

export const clickRegionDropdown = async () => clickButton(ManageOrganizationPage.regionCodeDropdownCss);

export const selectRegionFromDropdown = async (text: string) =>
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);

export const numberFormatDropdownVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.numberFormatDropdownCss);

export const clickNumberFormatDropdown = async () => clickButton(ManageOrganizationPage.numberFormatDropdownCss);

export const selectNumberFormatFromDropdown = async (text: string) =>
	clickElementByText(ManageOrganizationPage.dropdownOptionCss, text);

export const dateFormatDropdownVisible = async () =>
	verifyElementIsVisible(ManageOrganizationPage.dateFormatDropdownCss);

export const clickDateFormatDropdown = async () => clickButton(ManageOrganizationPage.dateFormatDropdownCss);

export const selectDateFormatFromDropdown = async () => {
	const today = dayjs().format('MM/DD/YYYY');
	await clickElementByText(ManageOrganizationPage.dropdownOptionCss, today);
};

export const saveButtonVisible = async () => verifyElementIsVisible(ManageOrganizationPage.saveButtonCss);

export const clickSaveButton = async () => clickButton(ManageOrganizationPage.saveButtonCss);

export const selectTableRow = async () => getLastElement(ManageOrganizationPage.tableRowCss);
