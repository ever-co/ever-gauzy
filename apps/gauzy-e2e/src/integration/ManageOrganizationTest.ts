import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as addOrganizationPage from '../support/Base/pages/AddOrganization.po';
import { AddOrganizationPageData } from '../support/Base/pagedata/AddOrganizationPageData';
import * as manageOrganizationPage from '../support/Base/pages/ManageOrganization.po';
import * as faker from 'faker';
import { ManageOrganizationPageData } from '../support/Base/pagedata/ManageOrganizationPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';

let organizationName = ' ';
let taxId = ' ';
let street = ' ';

describe('Manage Organization Test', () => {
	before(() => {
		organizationName = faker.company.companyName();
		taxId = faker.random.alphaNumeric();
		street = faker.address.streetAddress();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to manage organization', () => {
		CustomCommands.addOrganization(
			addOrganizationPage,
			organizationName,
			AddOrganizationPageData,
			taxId,
			street
		);
		manageOrganizationPage.gridBtnExists();
		manageOrganizationPage.gridBtnClick(1);
		manageOrganizationPage.selectTableRow();
		manageOrganizationPage.manageBtnExists();
		manageOrganizationPage.manageBtnClick();
		manageOrganizationPage.enterOrganizationName(organizationName);
		manageOrganizationPage.selectCurrency(
			ManageOrganizationPageData.currency
		);
		manageOrganizationPage.enterOfficialName(organizationName);
		manageOrganizationPage.enterTaxId(taxId);
		manageOrganizationPage.tabButtonVisible();
		manageOrganizationPage.clickTabButton(1);
		manageOrganizationPage.countryDropdownVisible();
		manageOrganizationPage.clickCountryDropdown();
		manageOrganizationPage.selectCountryFromDropdown(
			ManageOrganizationPageData.country
		);
		manageOrganizationPage.cityInputVisible();
		manageOrganizationPage.enterCityInputData(
			ManageOrganizationPageData.city
		);
		manageOrganizationPage.postcodeInputVisible();
		manageOrganizationPage.enterPostcodeInputData(
			ManageOrganizationPageData.postcode
		);
		manageOrganizationPage.streetInputVisible();
		manageOrganizationPage.enterStreetInputData(street);
		manageOrganizationPage.tabButtonVisible();
		manageOrganizationPage.clickTabButton(2);
		manageOrganizationPage.timeZoneDropdownVisible();
		manageOrganizationPage.clickTimeZoneDropdown();
		manageOrganizationPage.selectTimeZoneFromDropdown(
			ManageOrganizationPageData.timeZone
		);
		manageOrganizationPage.startOfWeekDropdownVisible();
		manageOrganizationPage.clickStartOfWeekDropdown();
		manageOrganizationPage.selectStartOfWeekFromDropdown(
			ManageOrganizationPageData.startOfWeek
		);
		manageOrganizationPage.dateTypeDropdownVisible();
		manageOrganizationPage.clickDateTypeDropdown();
		manageOrganizationPage.selectDateTypeFromDropdown(
			ManageOrganizationPageData.dateType
		);
		manageOrganizationPage.regionDropdownVisible();
		manageOrganizationPage.clickRegionDropdown();
		manageOrganizationPage.selectRegionFromDropdown(
			ManageOrganizationPageData.region
		);
		manageOrganizationPage.numberFormatDropdownVisible();
		manageOrganizationPage.clickNumberFormatDropdown();
		manageOrganizationPage.selectNumberFormatFromDropdown(
			ManageOrganizationPageData.numberFormat
		);
		manageOrganizationPage.dateFormatDropdownVisible();
		manageOrganizationPage.clickDateFormatDropdown();
		manageOrganizationPage.selectDateFormatFromDropdown();
		manageOrganizationPage.clickTabButton(0);
		manageOrganizationPage.saveButtonVisible();
		manageOrganizationPage.clickSaveButton();
		manageOrganizationPage.waitMessageToHide();
		cy.visit('/#/pages/organizations');
		manageOrganizationPage.verifyOrganizationExists(organizationName);
	});
});
