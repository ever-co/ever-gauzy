import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addOrganizationPage from '../support/Base/pages/AddOrganization.po';
import * as faker from 'faker';
import { AddOrganizationPageData } from '../support/Base/pagedata/AddOrganizationPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let organizationName = ' ';
let taxId = ' ';

describe('Create Organization Test', () => {
	before(() => {
		organizationName = faker.company.companyName();
		taxId = faker.random.alphaNumeric();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should able to create organization', () => {
		cy.visit('/#/pages/organizations');
		addOrganizationPage.addBtnExists();
		addOrganizationPage.addBtnClick();
		addOrganizationPage.enterOrganizationName(organizationName);
		addOrganizationPage.selectCurrency(AddOrganizationPageData.currency);
		addOrganizationPage.enterOfficialName(organizationName);
		addOrganizationPage.enterTaxId(taxId);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.countryDropdownVisible();
		addOrganizationPage.clickCountryDropdown();
		addOrganizationPage.selectCountryFromDropdown(
			AddOrganizationPageData.country
		);
		addOrganizationPage.cityInputVisible();
		addOrganizationPage.enterCityInputData(AddOrganizationPageData.city);
		addOrganizationPage.postcodeInputVisible();
		addOrganizationPage.enterPostcodeInputData(
			AddOrganizationPageData.postcode
		);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.bonusTypeDropdownVisible();
		addOrganizationPage.clickBonusTypeDropdown();
		addOrganizationPage.selectBonusTypeFromDropdown(
			AddOrganizationPageData.bonusType
		);
		addOrganizationPage.bonusPercentageInputVisible();
		addOrganizationPage.enterBonusPercentageInputData(
			AddOrganizationPageData.bonusPercentage
		);
		addOrganizationPage.expiryPeriodInputVisible();
		addOrganizationPage.enterExpiryPeriodInputData(
			AddOrganizationPageData.expiryPeriod
		);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.timeZoneDropdownVisible();
		addOrganizationPage.clickTimeZoneDropdown();
		addOrganizationPage.selectTimeZoneFromDropdown(
			AddOrganizationPageData.timeZone
		);
		addOrganizationPage.startOfWeekDropdownVisible();
		addOrganizationPage.clickStartOfWeekDropdown();
		addOrganizationPage.selectStartOfWeekFromDropdown(
			AddOrganizationPageData.startOfWeek
		);
		addOrganizationPage.dateTypeDropdownVisible();
		addOrganizationPage.clickDateTypeDropdown();
		addOrganizationPage.selectDateTypeFromDropdown(
			AddOrganizationPageData.dateType
		);
		addOrganizationPage.regionDropdownVisible();
		addOrganizationPage.clickRegionDropdown();
		addOrganizationPage.selectRegionFromDropdown(
			AddOrganizationPageData.region
		);
		addOrganizationPage.numberFormatDropdownVisible();
		addOrganizationPage.clickNumberFormatDropdown();
		addOrganizationPage.selectNumberFormatFromDropdown(
			AddOrganizationPageData.numberFormat
		);
		addOrganizationPage.dateFormatDropdownVisible();
		addOrganizationPage.clickDateFormatDropdown();
		addOrganizationPage.selectDateFormatFromDropdown(
			AddOrganizationPageData.dateFormat
		);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.waitMessageToHide();
		addOrganizationPage.verifyOrganizationExists(organizationName);
	});
});
