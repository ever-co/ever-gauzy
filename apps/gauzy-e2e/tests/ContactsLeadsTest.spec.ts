import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as contactsLeadsPage from './support/pages/ContactsLeads.po';
import { faker } from '@faker-js/faker';
import { ContactsLeadsPageData } from '../src/support/Base/pagedata/ContactsLeadsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from './support/commands';

let email = ' ';
let fullName = ' ';
let deleteName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

test.describe('Contacts leads test', () => {
	test('Contacts leads test', async () => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		deleteName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new lead', async () => {
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

		await test.step('Should be able to invite lead', async () => {
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

		await test.step('Should be able to edit lead', async () => {
			await contactsLeadsPage.tableRowVisible();
			await contactsLeadsPage.selectTableRow(0);
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
			await contactsLeadsPage.verifyNextButtonVisible();
			await contactsLeadsPage.clickNextButton();
			await contactsLeadsPage.verifyFinishButtonVisible();
			await contactsLeadsPage.clickFinishButton();
			await contactsLeadsPage.waitMessageToHide();
			await contactsLeadsPage.verifyLeadExists(deleteName);
		});

		await test.step('Should be able to delete lead', async () => {
			await contactsLeadsPage.selectTableRow(0);
			await contactsLeadsPage.deleteButtonVisible();
			await contactsLeadsPage.clickDeleteButton();
			await contactsLeadsPage.confirmDeleteButtonVisible();
			await contactsLeadsPage.clickConfirmDeleteButton();
			await contactsLeadsPage.waitMessageToHide();
			await contactsLeadsPage.verifyElementIsDeleted(deleteName);
		});
	});
});
