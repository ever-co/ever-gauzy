import dayjs from 'dayjs';
import {
	clearField,
	clickButton,
	clickByText,
	clickElementByText,
	enterInput,
	scrollUp,
	verifyByText,
	verifyElementIsVisible,
	waitElementToHide,
	waitUntil,
	clickButtonByIndex,
	verifyText,
	getLastElement
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationPublicPage } from '../../../src/support/Base/pageobjects/OrganizationPublicPagePageObject';

export const organizationDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.organizationDropdownCss);
};

export const clickOrganizationDropdown = async () => {
	await clickButton(OrganizationPublicPage.organizationDropdownCss);
};

export const selectOrganization = async (name: string) => {
	await clickElementByText(OrganizationPublicPage.organizationDropdownOptionsCss, name);
};

// Add new public profile link
export const organizationNameFilterInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.nameFilterInputCss);
};

export const enterOrganizationNameFilterInputData = async (name: string) => {
	await enterInput(OrganizationPublicPage.nameFilterInputCss, name);
	await waitUntil(2000);
};

export const verifyOrganizationNameTableRowContains = async (text: string) => {
	await verifyByText(OrganizationPublicPage.organizationNameTableCellCss, text);
};

export const selectOrganizationTableRow = async () => {
	await clickButton(OrganizationPublicPage.organizationTableRowCss);
};

export const manageBtnExists = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.manageButtonCss);
};

export const manageBtnClick = async () => {
	await clickButton(OrganizationPublicPage.manageButtonCss);
};

export const profileLinkInputVisible = async () => {
	await waitUntil(3000);
	await verifyElementIsVisible(OrganizationPublicPage.profileLinkInputCss);
};

export const enterProfileLinkInputData = async (data: string) => {
	await clearField(OrganizationPublicPage.profileLinkInputCss);
	await enterInput(OrganizationPublicPage.profileLinkInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(OrganizationPublicPage.saveButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationPublicPage.toastrMessageCss);
};

// Edit public page
export const editPageButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.editPageButtonCss);
};

export const clickEditPageButton = async () => {
	await clickButton(OrganizationPublicPage.editPageButtonCss);
};

export const companyNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.companyNameInputCss);
};

export const enterCompanyNameInputData = async (data: string) => {
	await enterInput(OrganizationPublicPage.companyNameInputCss, data);
};

export const companySizeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.companySizeInputCss);
};

export const enterCompanySizeInputData = async (data: number) => {
	await clearField(OrganizationPublicPage.companySizeInputCss);
	await enterInput(OrganizationPublicPage.companySizeInputCss, String(data));
};

export const yearFoundedInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.yearFoundedInputCss);
};

export const enterYearFoundedInputData = async (data: number) => {
	await clearField(OrganizationPublicPage.yearFoundedInputCss);
	await enterInput(OrganizationPublicPage.yearFoundedInputCss, String(data));
};

export const bannerInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.bannerInputCss);
};

export const enterBannerInputData = async (data: string) => {
	await enterInput(OrganizationPublicPage.bannerInputCss, data);
};

export const minimumProjectSizeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.minimumProjectSizeDropdownCss);
};

export const clickMinimumProjectSizeDropdown = async () => {
	await clickButton(OrganizationPublicPage.minimumProjectSizeDropdownCss);
};

export const selectMinimumProjectSizeDropdownOption = async (text: string) => {
	await clickByText(OrganizationPublicPage.minimumProjectSizeDropdownOptionsCss, text);
};

export const clientFocusDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.clientFocusDropdownCss);
};

export const clickClientFocusDropdown = async () => {
	await clickButton(OrganizationPublicPage.clientFocusDropdownCss);
};

export const selectClientFocusDropdownOptions = async (text: string) => {
	await clickByText(OrganizationPublicPage.clientFocusDropdownOptionsCss, text);
};

export const descriptionTabVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardsTabCss);
};

export const clickDescriptionTab = async () => {
	await clickByText(OrganizationPublicPage.awardsTabCss, 'Description');
};

export const shortDescriptionVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.shortDescriptionInputCss);
};

export const enterShortDescriptionInputData = async (data: string) => {
	await enterInput(OrganizationPublicPage.shortDescriptionInputCss, data);
};

export const awardsTabVisible = async () => {
	await scrollUp(OrganizationPublicPage.cardBodyCss);
	await verifyElementIsVisible(OrganizationPublicPage.awardsTabCss);
};

export const clickAwardsTab = async () => {
	await clickByText(OrganizationPublicPage.awardsTabCss, 'Awards');
};

export const addAwardsButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.addAwardsButtonCss);
};

export const clickAwardButton = async () => {
	await clickButton(OrganizationPublicPage.addAwardsButtonCss);
};

export const awardNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardNameInputCss);
};

export const enterAwardNameInputData = async (data: string) => {
	await enterInput(OrganizationPublicPage.awardNameInputCss, data);
};

export const awardYearInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardYearInputCss);
};

export const enterAwardYearInputData = async (data: number) => {
	await enterInput(OrganizationPublicPage.awardYearInputCss, String(data));
};

export const awardsSaveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardsSaveButtonCss);
};

export const clickAwardsSaveButton = async () => {
	await clickButton(OrganizationPublicPage.awardsSaveButtonCss);
};

export const skillsTabVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.skillsTabCss);
};

export const clickSkillsTab = async () => {
	await clickByText(OrganizationPublicPage.skillsTabCss, 'Skills');
};

export const skillsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.skillsDropdownCss);
};

export const clickSkillsDropdown = async () => {
	await clickButton(OrganizationPublicPage.skillsDropdownCss);
};

export const selectSkillsFromDropdownOptions = async (options: string[]) => {
	for (let index = 0; index < options.length; index++) {
		const option = options[index];
		if (index === 0) {
			await clickByText(OrganizationPublicPage.skillsDropdownOptionsCss, option);
			continue;
		}

		await clickSkillsDropdown();
		await clickByText(OrganizationPublicPage.skillsDropdownOptionsCss, option);
	}
};

export const languagesTabVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languagesTabCss);
};

export const clickLanguagesTab = async () => {
	await clickByText(OrganizationPublicPage.languagesTabCss, 'Languages');
};

export const addLanguageButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.addLanguageButtonCss);
};

export const clickAddLanguageButton = async () => {
	await clickButton(OrganizationPublicPage.addLanguageButtonCss);
};

export const languageDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languageDropdownCss);
};

export const clickLanguageDropdown = async () => {
	await clickButton(OrganizationPublicPage.languageDropdownCss);
};

export const selectLanguageFromDropdownOptions = async (text: string) => {
	await clickByText(OrganizationPublicPage.languageDropdownOptionsCss, text);
};

export const languageLevelDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languageLevelDropdownCss);
};

export const selectLanguageLevelFromDropdownOptions = async (text: string) => {
	await clickByText(OrganizationPublicPage.languageLevelDropdownOptionsCss, text);
};

export const clickLanguageLevelDropdown = async () => {
	await clickButton(OrganizationPublicPage.languageLevelDropdownCss);
};

export const languagesSaveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languageSaveButtonCss);
};

export const clickLanguagesSaveButton = async () => {
	await clickButton(OrganizationPublicPage.languageSaveButtonCss);
};

export const updateButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.updateButtonCss);
};

export const clickUpdateButton = async () => {
	await clickButton(OrganizationPublicPage.updateButtonCss);
};

// Verify public page data
export const verifyCompanyName = async (text: string) => {
	await verifyByText(OrganizationPublicPage.companyNameCss, text);
};

export const verifyBanner = async (text: string) => {
	await verifyByText(OrganizationPublicPage.bannerCss, text);
};

export const verifyCompanySize = async (text: string) => {
	await verifyByText(OrganizationPublicPage.companySizeCss, text);
};

export const verifyTotalClients = async (text: string) => {
	await verifyByText(OrganizationPublicPage.totalClientsCss, text);
};

export const verifyClientFocus = async (text: string) => {
	await verifyByText(OrganizationPublicPage.clientFocusCss, text);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addBtnExists = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.addButtonCss);
};

export const addBtnClick = async () => {
	await clickButton(OrganizationPublicPage.addButtonCss);
};

export const verifyOrganisationNameField = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.organizationNameFieldCss);
};

export const enterOrganizationName = async (data) => {
	await clearField(OrganizationPublicPage.organizationNameFieldCss);
	await enterInput(OrganizationPublicPage.organizationNameFieldCss, data);
};

export const selectCurrency = async (data) => {
	await clickButton(OrganizationPublicPage.currencyFieldCss);
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, data);
};

export const enterOfficialName = async (data) => {
	await enterInput(OrganizationPublicPage.officialNameFieldCss, data);
};

export const enterTaxId = async (data) => {
	await enterInput(OrganizationPublicPage.taxFieldCss, data);
};

export const clickOnNextButton = async () => {
	await clickButton(OrganizationPublicPage.nextButtonCss);
};

export const verifyOrganizationExists = async (text) => {
	await verifyText(OrganizationPublicPage.verifyOrganizationCss, text);
};

export const countryDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.countryDropdownCss);
};

export const clickCountryDropdown = async () => {
	await clickButton(OrganizationPublicPage.countryDropdownCss);
};

export const selectCountryFromDropdown = async (text) => {
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, text);
};

export const cityInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.cityInputCss);
};

export const enterCityInputData = async (data) => {
	await clearField(OrganizationPublicPage.cityInputCss);
	await enterInput(OrganizationPublicPage.cityInputCss, data);
};

export const postcodeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.postCodeInputCss);
};

export const enterPostcodeInputData = async (data) => {
	await clearField(OrganizationPublicPage.postCodeInputCss);
	await enterInput(OrganizationPublicPage.postCodeInputCss, data);
};

export const streetInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.streetInputCss);
};

export const enterStreetInputData = async (data) => {
	await clearField(OrganizationPublicPage.streetInputCss);
	await enterInput(OrganizationPublicPage.streetInputCss, data);
};

export const bonusTypeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.bonusTypeDropdownCss);
};

export const clickBonusTypeDropdown = async () => {
	await clickButton(OrganizationPublicPage.bonusTypeDropdownCss);
};

export const selectBonusTypeFromDropdown = async (text) => {
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, text);
};

export const bonusPercentageInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.bonusPercentageCss);
};

export const enterBonusPercentageInputData = async (data) => {
	await clearField(OrganizationPublicPage.bonusPercentageCss);
	await enterInput(OrganizationPublicPage.bonusPercentageCss, data);
};

export const expiryPeriodInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.expiryPeriodInputCss);
};

export const enterExpiryPeriodInputData = async (data) => {
	await clearField(OrganizationPublicPage.expiryPeriodInputCss);
	await enterInput(OrganizationPublicPage.expiryPeriodInputCss, data);
};

export const timeZoneDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.timeZoneDropdownCss);
};

export const clickTimeZoneDropdown = async () => {
	await clickButton(OrganizationPublicPage.timeZoneDropdownCss);
};

export const selectTimeZoneFromDropdown = async (text) => {
	await clickElementByText(OrganizationPublicPage.timeZoneDropdownOptionCss, text);
};

export const startOfWeekDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.startOfWeekDropdownCss);
};

export const clickStartOfWeekDropdown = async () => {
	await clickButton(OrganizationPublicPage.startOfWeekDropdownCss);
};

export const selectStartOfWeekFromDropdown = async (text) => {
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, text);
};

export const dateTypeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.dateTypeDropdownCss);
};

export const clickDateTypeDropdown = async () => {
	await clickButton(OrganizationPublicPage.dateTypeDropdownCss);
};

export const selectDateTypeFromDropdown = async (text) => {
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, text);
};

export const regionDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.regionCodeDropdownCss);
};

export const clickRegionDropdown = async () => {
	await clickButton(OrganizationPublicPage.regionCodeDropdownCss);
};

export const selectRegionFromDropdown = async (text) => {
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, text);
};

export const numberFormatDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.numberFormatDropdownCss);
};

export const clickNumberFormatDropdown = async () => {
	await clickButton(OrganizationPublicPage.numberFormatDropdownCss);
};

export const selectNumberFormatFromDropdown = async (text) => {
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, text);
};

export const dateFormatDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.dateFormatDropdownCss);
};

export const clickDateFormatDropdown = async () => {
	await clickButton(OrganizationPublicPage.dateFormatDropdownCss);
};

export const selectDateFormatFromDropdown = async () => {
	const today = dayjs().format('MM/DD/YYYY');
	await clickElementByText(OrganizationPublicPage.dropdownOptionCss, today);
};

export const selectTableRow = async () => {
	await getLastElement(OrganizationPublicPage.tableRowCss);
};
