import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as addOrganizationPage from './support/pages/AddOrganization.po';
import { faker } from '@faker-js/faker';
import { AddOrganizationPageData } from '../src/support/Base/pagedata/AddOrganizationPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';

let organizationName = ' ';
let taxId = ' ';
let street = ' ';

test.describe('Create Organization Test', () => {
	test('Create Organization Test', async () => {
		organizationName = faker.company.name();
		taxId = faker.string.alphanumeric();
		street = faker.location.streetAddress();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should able to create organization', async () => {
			await getPage().goto('/#/pages/organizations');
			await addOrganizationPage.addBtnExists();
			await addOrganizationPage.addBtnClick();
			await addOrganizationPage.enterOrganizationName(organizationName);
			await addOrganizationPage.selectCurrency(AddOrganizationPageData.currency);
			await addOrganizationPage.enterOfficialName(organizationName);
			await addOrganizationPage.enterTaxId(taxId);
			await addOrganizationPage.clickOnNextButton();
			await addOrganizationPage.countryDropdownVisible();
			await addOrganizationPage.clickCountryDropdown();
			await addOrganizationPage.selectCountryFromDropdown(AddOrganizationPageData.country);
			await addOrganizationPage.cityInputVisible();
			await addOrganizationPage.enterCityInputData(AddOrganizationPageData.city);
			await addOrganizationPage.postcodeInputVisible();
			await addOrganizationPage.enterPostcodeInputData(AddOrganizationPageData.postcode);
			await addOrganizationPage.streetInputVisible();
			await addOrganizationPage.enterStreetInputData(street);
			await addOrganizationPage.clickOnNextButton();
			await addOrganizationPage.bonusTypeDropdownVisible();
			await addOrganizationPage.clickBonusTypeDropdown();
			await addOrganizationPage.selectBonusTypeFromDropdown(AddOrganizationPageData.bonusType);
			await addOrganizationPage.bonusPercentageInputVisible();
			await addOrganizationPage.enterBonusPercentageInputData(AddOrganizationPageData.bonusPercentage);
			await addOrganizationPage.clickOnNextButton();
			await addOrganizationPage.timeZoneDropdownVisible();
			await addOrganizationPage.clickTimeZoneDropdown();
			await addOrganizationPage.selectTimeZoneFromDropdown(AddOrganizationPageData.timeZone);
			await addOrganizationPage.startOfWeekDropdownVisible();
			await addOrganizationPage.clickStartOfWeekDropdown();
			await addOrganizationPage.selectStartOfWeekFromDropdown(AddOrganizationPageData.startOfWeek);
			await addOrganizationPage.dateTypeDropdownVisible();
			await addOrganizationPage.clickDateTypeDropdown();
			await addOrganizationPage.selectDateTypeFromDropdown(AddOrganizationPageData.dateType);
			await addOrganizationPage.regionDropdownVisible();
			await addOrganizationPage.clickRegionDropdown();
			await addOrganizationPage.selectRegionFromDropdown(AddOrganizationPageData.region);
			await addOrganizationPage.numberFormatDropdownVisible();
			await addOrganizationPage.clickNumberFormatDropdown();
			await addOrganizationPage.selectNumberFormatFromDropdown(AddOrganizationPageData.numberFormat);
			await addOrganizationPage.dateFormatDropdownVisible();
			await addOrganizationPage.clickDateFormatDropdown();
			await addOrganizationPage.selectDateFormatFromDropdown();
			await addOrganizationPage.expiryPeriodInputVisible();
			await addOrganizationPage.enterExpiryPeriodInputData(AddOrganizationPageData.expiryPeriod);
			await addOrganizationPage.clickOnNextButton();
			await addOrganizationPage.waitMessageToHide();
			await addOrganizationPage.verifyOrganizationExists(organizationName);
		});
	});
});
