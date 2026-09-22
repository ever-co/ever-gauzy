import { When } from '../../support/bdd';
import { getPage } from '../../support/page-context';
import * as customersPage from '../../support/pages/Customers.po';
import { faker } from '@faker-js/faker';
import { CustomersPageData } from '../../../src/support/Base/pagedata/CustomersPageData';
import * as organizationProjectsPage from '../../support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain CustomersTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence (verification folded in),
// so runtime behaviour is identical to the already-CI-tested spec. The faker-generated values are
// shared across steps, so they live at module scope and are initialised at the very start of the first
// step (one scenario per feature keeps module scope safe). The `Given I am logged in as the default
// user` Background step is defined once in common.steps.ts.

let email = ' ';
let fullName = ' ';
let inviteName = ' ';
let deleteName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

When('I add a new customer', async () => {
	email = faker.internet.exampleEmail();
	fullName = faker.person.firstName() + ' ' + faker.person.lastName();
	// Invite must create a SEPARATE record with its OWN unique name (mirrors the verified-green
	// ClientsTest). Reusing `fullName` for both add + invite left two identically-named rows in the
	// shared serial grid, so the later select-by-name became ambiguous and the invite's own
	// verify/close raced against the add row of the same name. A distinct name keeps every downstream
	// select-by-name (edit picks fullName, delete picks deleteName) unambiguous.
	inviteName = faker.person.firstName() + ' ' + faker.person.lastName();
	deleteName = faker.person.firstName() + ' ' + faker.person.lastName();
	city = faker.location.city();
	postcode = faker.location.zipCode();
	street = faker.location.streetAddress();
	website = faker.internet.url();

	await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
	await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
	// addTag leaves us under the /pages/organization hash route. A goto() that only
	// changes the hash fragment (same origin+path) is a Playwright no-op, so force the
	// SPA hash router to switch to the customers route before interacting.
	await getPage().goto('/#/pages/contacts/customers');
	await getPage().evaluate(() => {
		if (!location.hash.includes('/pages/contacts/customers')) {
			location.hash = '#/pages/contacts/customers';
		}
	});
	// Wait until the customers screen has actually rendered before interacting —
	// otherwise the add-button click can land on the previous screen still mounted
	// during the hash-route transition. Use the route component (language-agnostic).
	await getPage()
		.locator('ngx-contacts-list')
		.first()
		.waitFor({ state: 'visible', timeout: 30000 });
	await customersPage.gridBtnExists();
	await customersPage.gridBtnClick(1);
	await customersPage.addButtonVisible();
	await customersPage.clickAddButton();
	await customersPage.nameInputVisible();
	await customersPage.enterNameInputData(fullName);
	await customersPage.emailInputVisible();
	await customersPage.enterEmailInputData(email);
	await customersPage.phoneInputVisible();
	await customersPage.enterPhoneInputData(CustomersPageData.defaultPhone);
	await customersPage.projectDropdownVisible();
	await customersPage.clickProjectDropdown();
	await customersPage.selectProjectFromDropdown(CustomersPageData.defaultProject);
	await customersPage.tagsMultiSelectVisible();
	await customersPage.clickTagsMultiSelect();
	await customersPage.selectTagsFromDropdown(0);
	await customersPage.clickCardBody();
	await customersPage.websiteInputVisible();
	await customersPage.enterWebsiteInputData(website);
	await customersPage.saveButtonVisible();
	await customersPage.clickSaveButton();
	await customersPage.countryDropdownVisible();
	await customersPage.clickCountryDropdown();
	await customersPage.selectCountryFromDropdown(CustomersPageData.country);
	await customersPage.cityInputVisible();
	await customersPage.enterCityInputData(city);
	await customersPage.postcodeInputVisible();
	await customersPage.enterPostcodeInputData(postcode);
	await customersPage.streetInputVisible();
	await customersPage.enterStreetInputData(street);
	// Address step -> Budget step
	await customersPage.verifyNextButtonVisible();
	await customersPage.clickNextButton();
	// Budget step (defaults are valid) -> Members step
	await customersPage.verifyNextButtonVisible();
	await customersPage.clickNextButton();
	await customersPage.selectEmployeeDropdownVisible();
	await customersPage.clickSelectEmployeeDropdown();
	await customersPage.selectEmployeeDropdownOption(0);
	await customersPage.clickKeyboardButtonByKeyCode(9);
	await customersPage.verifyFinishButtonVisible();
	await customersPage.clickFinishButton();
	await customersPage.waitMessageToHide();
	await customersPage.verifyCustomerExists(fullName);
});

When('I invite a customer', async () => {
	await customersPage.inviteButtonVisible();
	await customersPage.clickInviteButton();
	await customersPage.customerNameInputVisible();
	// Invite a DISTINCT name + email so the created contact does not collide with the add row
	// (the invite email validator also rejects an email already tied to a user, so a fresh email
	// keeps the Email-Invite button enabled).
	await customersPage.enterCustomerNameData(inviteName);
	await customersPage.customerPhoneInputVisible();
	await customersPage.enterCustomerPhoneData(CustomersPageData.defaultPhone);
	await customersPage.customerEmailInputVisible();
	await customersPage.enterCustomerEmailData(faker.internet.exampleEmail());
	await customersPage.saveInviteButtonVisible();
	await customersPage.clickSaveInviteButton();
	await customersPage.waitMessageToHide();
	await customersPage.verifyCustomerExists(inviteName);
});

When('I edit the customer', async () => {
	await customersPage.tableRowVisible();
	// Select the row we actually created by its UNIQUE name, not nth(0): the shared serial DB holds
	// rows from earlier specs and this spec's own add+invite create two rows, so a fixed index picks
	// the wrong record. Edit then renames that row from fullName -> deleteName.
	await customersPage.selectTableRowByText(fullName);
	await customersPage.editButtonVisible();
	await customersPage.clickEditButton(fullName);
	await customersPage.nameInputVisible();
	await customersPage.enterNameInputData(deleteName);
	await customersPage.emailInputVisible();
	await customersPage.enterEmailInputData(email);
	await customersPage.phoneInputVisible();
	await customersPage.enterPhoneInputData(CustomersPageData.defaultPhone);
	await customersPage.websiteInputVisible();
	await customersPage.enterWebsiteInputData(website);
	// Re-set Name LAST (raw fill): clearing-then-filling website above re-triggers the form's
	// Name-reset, which would otherwise persist the original name and make the rename a silent
	// no-op (so "deleteName" would never appear and the later delete-by-name would find nothing).
	await customersPage.reenterNameInputData(deleteName);
	await customersPage.saveButtonVisible();
	await customersPage.clickSaveButton();
	await customersPage.countryDropdownVisible();
	await customersPage.clickCountryDropdown();
	await customersPage.selectCountryFromDropdown(CustomersPageData.country);
	await customersPage.cityInputVisible();
	await customersPage.enterCityInputData(city);
	await customersPage.postcodeInputVisible();
	await customersPage.enterPostcodeInputData(postcode);
	await customersPage.streetInputVisible();
	await customersPage.enterStreetInputData(street);
	// Address step -> Budget step
	await customersPage.verifyNextButtonVisible();
	await customersPage.clickNextButton();
	// Budget step -> Members step
	await customersPage.verifyNextButtonVisible();
	await customersPage.clickNextButton();
	await customersPage.verifyFinishButtonVisible();
	await customersPage.clickFinishButton();
	await customersPage.waitMessageToHide();
	await customersPage.verifyCustomerExists(deleteName);
});

When('I delete the customer', async () => {
	// Select the EDITED row by its unique deleteName (it was renamed from fullName in the edit step).
	// nth(0) would delete whichever record sorts first (often the still-present fullName/invited row),
	// leaving deleteName behind and failing verifyElementIsDeleted — the round-5 failure.
	await customersPage.selectTableRowByText(deleteName);
	await customersPage.deleteButtonVisible();
	await customersPage.clickDeleteButton();
	await customersPage.confirmDeleteButtonVisible();
	await customersPage.clickConfirmDeleteButton();
	await customersPage.waitMessageToHide();
	await customersPage.verifyElementIsDeleted(deleteName);
});
