import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as contactsLeadsPage from '../support/Base/pages/ContactsLeads.po';
import * as faker from 'faker';
import { ContactsLeadsPageData } from '../support/Base/pagedata/ContactsLeadsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';

let email = ' ';
let fullName = ' ';
let deleteName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

describe('Contacts leads test', () => {
	before(() => {
		email = faker.internet.email();
		fullName = faker.name.firstName() + ' ' + faker.name.lastName();
		deleteName = faker.name.firstName() + ' ' + faker.name.lastName();
		city = faker.address.city();
		postcode = faker.address.zipCode();
		street = faker.address.streetAddress();
		website = faker.internet.url();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new lead', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		CustomCommands.addContact(
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
	it('Should be able to invite lead', () => {
		contactsLeadsPage.waitMessageToHide();
		contactsLeadsPage.inviteButtonVisible();
		contactsLeadsPage.clickInviteButton();
		contactsLeadsPage.contactNameInputVisible();
		contactsLeadsPage.enterContactNameData(fullName);
		contactsLeadsPage.contactPhoneInputVisible();
		contactsLeadsPage.enterContactPhoneData(
			ContactsLeadsPageData.defaultPhone
		);
		contactsLeadsPage.contactEmailInputVisible();
		contactsLeadsPage.enterContactEmailData(email);
		contactsLeadsPage.saveInvitebuttonVisible();
		contactsLeadsPage.clickSaveInviteButton();
		contactsLeadsPage.waitMessageToHide();
		contactsLeadsPage.verifyLeadExists(fullName);
	});
	it('Should be able to edit lead', () => {
		contactsLeadsPage.tableRowVisible();
		contactsLeadsPage.selectTableRow(0);
		contactsLeadsPage.editButtonVisible();
		contactsLeadsPage.clickEditButton();
		contactsLeadsPage.nameInputVisible();
		contactsLeadsPage.enterNameInputData(deleteName);
		contactsLeadsPage.emailInputVisible();
		contactsLeadsPage.enterEmailInputData(email);
		contactsLeadsPage.phoneInputVisible();
		contactsLeadsPage.enterPhoneInputData(
			ContactsLeadsPageData.defaultPhone
		);
		contactsLeadsPage.websiteInputVisible();
		contactsLeadsPage.enterWebsiteInputData(website);
		contactsLeadsPage.saveButtonVisible();
		contactsLeadsPage.clickSaveButton();
		contactsLeadsPage.countryDropdownVisible();
		contactsLeadsPage.clickCountryDropdown();
		contactsLeadsPage.selectCountryFromDropdown(
			ContactsLeadsPageData.country
		);
		contactsLeadsPage.cityInputVisible();
		contactsLeadsPage.enterCityInputData(city);
		contactsLeadsPage.postcodeInputVisible();
		contactsLeadsPage.enterPostcodeInputData(postcode);
		contactsLeadsPage.streetInputVisible();
		contactsLeadsPage.enterStreetInputData(street);
		contactsLeadsPage.verifyNextButtonVisible();
		contactsLeadsPage.clickNextButton();
		contactsLeadsPage.verifyFinishButtonVisible();
		contactsLeadsPage.clickFinishButton();
		contactsLeadsPage.waitMessageToHide();
		contactsLeadsPage.verifyLeadExists(deleteName);
	});
	it('Should be able to delete lead', () => {
		contactsLeadsPage.selectTableRow(0);
		contactsLeadsPage.deleteButtonVisible();
		contactsLeadsPage.clickDeleteButton();
		contactsLeadsPage.confirmDeleteButtonVisible();
		contactsLeadsPage.clickConfirmDeleteButton();
		contactsLeadsPage.waitMessageToHide();
		contactsLeadsPage.verifyElementIsDeleted(deleteName);
	});
});
