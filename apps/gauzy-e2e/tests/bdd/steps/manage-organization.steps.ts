import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as addOrganizationPage from '../../support/pages/AddOrganization.po';
import { AddOrganizationPageData } from '../../../src/support/Base/pagedata/AddOrganizationPageData';
import * as manageOrganizationPage from '../../support/pages/ManageOrganization.po';
import { faker } from '@faker-js/faker';
import { ManageOrganizationPageData } from '../../../src/support/Base/pagedata/ManageOrganizationPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain ManageOrganizationTest.spec.ts: the single test() -> one Scenario, its
// lone test.step() -> one When step whose body is the verbatim call sequence (add-organization setup +
// manage flow + verification folded in), so runtime behaviour is identical to the already-CI-tested spec.
// The faker-generated values were declared at test() scope and set before the step ran; they move to
// module scope + first-step initialisation. The `Given I am logged in as the default user` Background
// step is defined once in common.steps.ts.

let organizationName = ' ';
let taxId = ' ';
let street = ' ';

When('I manage the organization', async () => {
	organizationName = faker.company.name();
	taxId = faker.string.alphanumeric();
	street = faker.location.streetAddress();

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
