import { When } from '../../support/bdd';
import * as contactsLeadsPage from '../../support/pages/ContactsLeads.po';
import { faker } from '@faker-js/faker';
import { ContactsLeadsPageData } from '../../../src/support/Base/pagedata/ContactsLeadsPageData';
import * as organizationProjectsPage from '../../support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../../../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../../support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../../../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../../support/commands';

// Converted 1:1 from the plain ContactsLeadsTest.spec.ts: the single test() -> one Scenario, each
// test.step() -> one When step whose body is the verbatim .po call sequence, so runtime behaviour is
// identical to the already-CI-tested spec. The faker-generated values are shared across steps, so they
// live at module scope and are initialised at the very start of the first step (one scenario per
// feature keeps module scope safe). The `Given I am logged in as the default user` Background step is
// defined once in common.steps.ts.

let email = ' ';
let fullName = ' ';
let deleteName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

When('I add a new lead', async () => {
	email = faker.internet.exampleEmail();
	fullName = faker.person.firstName() + ' ' + faker.person.lastName();
	deleteName = faker.person.firstName() + ' ' + faker.person.lastName();
	city = faker.location.city();
	postcode = faker.location.zipCode();
	street = faker.location.streetAddress();
	website = faker.internet.url();

	await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
	await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
	await CustomCommands.addContact(
		fullName,
		email,
		city,
		postcode,
		street,
		website,
		contactsLeadsPage,
		ContactsLeadsPageData
	);
});

When('I invite the lead', async () => {
	await contactsLeadsPage.waitMessageToHide();
	await contactsLeadsPage.inviteButtonVisible();
	await contactsLeadsPage.clickInviteButton();
	await contactsLeadsPage.contactNameInputVisible();
	await contactsLeadsPage.enterContactNameData(fullName);
	await contactsLeadsPage.contactPhoneInputVisible();
	await contactsLeadsPage.enterContactPhoneData(ContactsLeadsPageData.defaultPhone);
	await contactsLeadsPage.contactEmailInputVisible();
	await contactsLeadsPage.enterContactEmailData(email);
	await contactsLeadsPage.saveInviteButtonVisible();
	await contactsLeadsPage.clickSaveInviteButton();
	await contactsLeadsPage.waitMessageToHide();
	await contactsLeadsPage.verifyLeadExists(fullName);
});

When('I edit the lead', async () => {
	await contactsLeadsPage.tableRowVisible();
	// Select the lead BY NAME, not row 0: the invite step above created a SECOND lead with the
	// same `fullName`, so the grid now has >1 row and row 0 is not deterministically ours. Scope
	// to the unique faker name so the rename acts on the record this spec created.
	await contactsLeadsPage.selectTableRowByName(fullName);
	await contactsLeadsPage.editButtonVisible();
	await contactsLeadsPage.clickEditButton();
	await contactsLeadsPage.nameInputVisible();
	await contactsLeadsPage.enterNameInputData(deleteName);
	await contactsLeadsPage.emailInputVisible();
	await contactsLeadsPage.enterEmailInputData(email);
	await contactsLeadsPage.phoneInputVisible();
	await contactsLeadsPage.enterPhoneInputData(ContactsLeadsPageData.defaultPhone);
	await contactsLeadsPage.websiteInputVisible();
	await contactsLeadsPage.enterWebsiteInputData(website);
	// re-set Name last (raw fill): filling website above re-triggers the form's Name-reset, which
	// would otherwise save the original name and the rename would silently no-op.
	await contactsLeadsPage.reenterNameInputData(deleteName);
	await contactsLeadsPage.saveButtonVisible();
	await contactsLeadsPage.clickSaveButton();
	await contactsLeadsPage.countryDropdownVisible();
	await contactsLeadsPage.clickCountryDropdown();
	await contactsLeadsPage.selectCountryFromDropdown(ContactsLeadsPageData.country);
	await contactsLeadsPage.cityInputVisible();
	await contactsLeadsPage.enterCityInputData(city);
	await contactsLeadsPage.postcodeInputVisible();
	await contactsLeadsPage.enterPostcodeInputData(postcode);
	await contactsLeadsPage.streetInputVisible();
	await contactsLeadsPage.enterStreetInputData(street);
	// location (step 2) → budget (step 3): the edit reopens the same 4-step contact-mutation
	// stepper as add, so it must traverse budget + employees, not jump straight to finish.
	await contactsLeadsPage.verifyNextButtonVisible();
	await contactsLeadsPage.clickNextButton();
	await contactsLeadsPage.budgetInputVisible();
	await contactsLeadsPage.enterBudgetData(ContactsLeadsPageData.hours);
	await contactsLeadsPage.lastStepBtnVisible();
	await contactsLeadsPage.clickLastStepBtn();
	// employees (step 4) → finish
	await contactsLeadsPage.selectEmployeeDropdownVisible();
	await contactsLeadsPage.clickSelectEmployeeDropdown();
	await contactsLeadsPage.selectEmployeeDropdownOption(0);
	await contactsLeadsPage.clickKeyboardButtonByKeyCode(9);
	await contactsLeadsPage.verifyFinishButtonVisible();
	await contactsLeadsPage.clickFinishButton();
	await contactsLeadsPage.waitMessageToHide();
	await contactsLeadsPage.verifyLeadExists(deleteName);
});

When('I delete the lead', async () => {
	// Delete the RENAMED lead BY NAME, not row 0: with the extra invite-created lead still in the
	// grid, row 0 may be the other ("fullName") record, so a row-0 delete removes the wrong lead
	// and leaves `deleteName` behind (the verify-deleted then fails seeing it still present).
	await contactsLeadsPage.selectTableRowByName(deleteName);
	await contactsLeadsPage.deleteButtonVisible();
	await contactsLeadsPage.clickDeleteButton();
	await contactsLeadsPage.confirmDeleteButtonVisible();
	await contactsLeadsPage.clickConfirmDeleteButton();
	await contactsLeadsPage.waitMessageToHide();
	await contactsLeadsPage.verifyElementIsDeleted(deleteName);
});
