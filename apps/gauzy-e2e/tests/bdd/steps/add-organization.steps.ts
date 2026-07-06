import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as addOrganizationPage from '../../support/pages/AddOrganization.po';
import { faker } from '@faker-js/faker';
import { AddOrganizationPageData } from '../../../src/support/Base/pagedata/AddOrganizationPageData';

// Converted 1:1 from the plain AddOrganizationTest.spec.ts: the single test() -> one Scenario, its lone
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in), so
// runtime behaviour is identical to the already-CI-tested spec. The faker-generated values were declared
// at test() scope and set before the step ran; they move to module scope + first-step initialisation.
// The `Given I am logged in as the default user` Background step is defined once in common.steps.ts.

let organizationName = ' ';
let taxId = ' ';
let street = ' ';

When('I create an organization', async () => {
	organizationName = faker.company.name();
	taxId = faker.string.alphanumeric();
	street = faker.location.streetAddress();

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
