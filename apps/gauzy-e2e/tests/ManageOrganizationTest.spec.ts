import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addOrganizationPage from './support/pages/AddOrganization.po';
import { AddOrganizationPageData } from '../src/support/Base/pagedata/AddOrganizationPageData';
import * as manageOrganizationPage from './support/pages/ManageOrganization.po';
import { faker } from '@faker-js/faker';
import { ManageOrganizationPageData } from '../src/support/Base/pagedata/ManageOrganizationPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let organizationName = ' ';
let taxId = ' ';
let street = ' ';

test.describe('Manage Organization Test', () => {
	test('Manage Organization Test', async () => {
		organizationName = faker.company.name();
		taxId = faker.string.alphanumeric();
		street = faker.location.streetAddress();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to manage organization', async () => {
			await CustomCommands.addOrganization(
				addOrganizationPage,
				organizationName,
				AddOrganizationPageData,
				taxId,
				street
			);
			await manageOrganizationPage.gridBtnExists();
			await manageOrganizationPage.gridBtnClick(1);
			await manageOrganizationPage.selectTableRow();
			await manageOrganizationPage.manageBtnExists();
			await manageOrganizationPage.manageBtnClick();
			await manageOrganizationPage.enterOrganizationName(organizationName);
			await manageOrganizationPage.selectCurrency(
				ManageOrganizationPageData.currency
			);
			await manageOrganizationPage.enterOfficialName(organizationName);
			await manageOrganizationPage.enterTaxId(taxId);
			await manageOrganizationPage.tabButtonVisible();
			await manageOrganizationPage.clickTabButton(1);
			await manageOrganizationPage.countryDropdownVisible();
			await manageOrganizationPage.clickCountryDropdown();
			await manageOrganizationPage.selectCountryFromDropdown(
				ManageOrganizationPageData.country
			);
			await manageOrganizationPage.cityInputVisible();
			await manageOrganizationPage.enterCityInputData(
				ManageOrganizationPageData.city
			);
			await manageOrganizationPage.postcodeInputVisible();
			await manageOrganizationPage.enterPostcodeInputData(
				ManageOrganizationPageData.postcode
			);
			await manageOrganizationPage.streetInputVisible();
			await manageOrganizationPage.enterStreetInputData(street);
			await manageOrganizationPage.tabButtonVisible();
			await manageOrganizationPage.clickTabButton(2);
			await manageOrganizationPage.timeZoneDropdownVisible();
			await manageOrganizationPage.clickTimeZoneDropdown();
			await manageOrganizationPage.selectTimeZoneFromDropdown(
				ManageOrganizationPageData.timeZone
			);
			await manageOrganizationPage.startOfWeekDropdownVisible();
			await manageOrganizationPage.clickStartOfWeekDropdown();
			await manageOrganizationPage.selectStartOfWeekFromDropdown(
				ManageOrganizationPageData.startOfWeek
			);
			await manageOrganizationPage.dateTypeDropdownVisible();
			await manageOrganizationPage.clickDateTypeDropdown();
			await manageOrganizationPage.selectDateTypeFromDropdown(
				ManageOrganizationPageData.dateType
			);
			await manageOrganizationPage.regionDropdownVisible();
			await manageOrganizationPage.clickRegionDropdown();
			await manageOrganizationPage.selectRegionFromDropdown(
				ManageOrganizationPageData.region
			);
			await manageOrganizationPage.numberFormatDropdownVisible();
			await manageOrganizationPage.clickNumberFormatDropdown();
			await manageOrganizationPage.selectNumberFormatFromDropdown(
				ManageOrganizationPageData.numberFormat
			);
			await manageOrganizationPage.dateFormatDropdownVisible();
			await manageOrganizationPage.clickDateFormatDropdown();
			await manageOrganizationPage.selectDateFormatFromDropdown();
			await manageOrganizationPage.clickTabButton(0);
			await manageOrganizationPage.saveButtonVisible();
			await manageOrganizationPage.clickSaveButton();
			await manageOrganizationPage.waitMessageToHide();
			await getPage().goto('/#/pages/organizations');
			await manageOrganizationPage.verifyOrganizationExists(organizationName);
		});
	});
});
