import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as contactsLeadsPage from '../support/Base/pages/ContactsLeads.po';
import * as faker from 'faker';
import { ContactsLeadsPageData } from '../support/Base/pagedata/ContactsLeadsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as addTaskPage from '../support/Base/pages/AddTasks.po';
import { AddTasksPageData } from '../support/Base/pagedata/AddTasksPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';

let email = ' ';
let fullName = ' ';
let country = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

describe('Contacts leads test', () => {
	before(() => {
		email = faker.internet.email();
		fullName = faker.name.firstName() + ' ' + faker.name.lastName();
		country = faker.address.country();
		city = faker.address.city();
		postcode = faker.address.zipCode();
		street = faker.address.streetAddress();
		website = faker.internet.url();

		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	});

	it('Should be able to add new lead', () => {
		cy.visit('/#/pages/organization/projects');
		addTaskPage.requestProjectButtonVisible();
		addTaskPage.clickRequestProjectButton();
		addTaskPage.projectNameInputVisible();
		addTaskPage.enterProjectNameInputData(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.clickSelectEmployeeDropdown();
		addTaskPage.selectEmployeeDropdownOption(1);
		addTaskPage.selectEmployeeDropdownOption(2);
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.saveProjectButtonVisible();
		addTaskPage.clickSaveProjectButton();
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton(1);
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tageName
		);
		organizationTagsUserPage.tagColorInputVisible();
		organizationTagsUserPage.enterTagColorData(
			OrganizationTagsPageData.tagColor
		);
		organizationTagsUserPage.tagDescriptionTextareaVisible();
		organizationTagsUserPage.enterTagDescriptionData(
			OrganizationTagsPageData.tagDescription
		);
		organizationTagsUserPage.saveTagButtonVisible();
		organizationTagsUserPage.clickSaveTagButton();
		cy.visit('/#/pages/contacts/leads');
		contactsLeadsPage.gridBtnExists();
		contactsLeadsPage.gridBtnClick(1);
		contactsLeadsPage.addButtonVisible();
		contactsLeadsPage.clickAddButton();
		contactsLeadsPage.nameInputVisible();
		contactsLeadsPage.enterNameInputData(fullName);
		contactsLeadsPage.emailInputVisible();
		contactsLeadsPage.enterEmailInputData(email);
		contactsLeadsPage.phoneInputVisible();
		contactsLeadsPage.enterPhoneInputData(
			ContactsLeadsPageData.defaultPhone
		);
		contactsLeadsPage.countryInputVisible();
		contactsLeadsPage.enterCountryInputData(country);
		contactsLeadsPage.cityInputVisible();
		contactsLeadsPage.enterCityInputData(city);
		contactsLeadsPage.postcodeInputVisible();
		contactsLeadsPage.enterPostcodeInputData(postcode);
		contactsLeadsPage.streetInputVisible();
		contactsLeadsPage.enterStreetInputData(street);
		contactsLeadsPage.projectDropdownVisible();
		contactsLeadsPage.clickProjectDropdown();
		contactsLeadsPage.selectProjectFromDropdown(
			ContactsLeadsPageData.defaultProject
		);
		contactsLeadsPage.selectEmployeeDropdownVisible();
		contactsLeadsPage.clickSelectEmployeeDropdown();
		contactsLeadsPage.selectEmployeeDropdownOption(0);
		contactsLeadsPage.clickKeyboardButtonByKeyCode(9);
		contactsLeadsPage.tagsMultyselectVisible();
		contactsLeadsPage.clickTagsMultyselect();
		contactsLeadsPage.selectTagsFromDropdown(0);
		contactsLeadsPage.clickCardBody();
		contactsLeadsPage.websiteInputVisible();
		contactsLeadsPage.enterWebsiteInputData(website);
		contactsLeadsPage.saveButtonVisible();
		contactsLeadsPage.clickSaveButton();
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
	});
	it('Should be able to edit lead', () => {
		contactsLeadsPage.waitMessageToHide();
		contactsLeadsPage.tableRowVisible();
		contactsLeadsPage.selectTableRow(0);
		contactsLeadsPage.editButtonVisible();
		contactsLeadsPage.clickEditButton();
		contactsLeadsPage.nameInputVisible();
		contactsLeadsPage.enterNameInputData(fullName);
		contactsLeadsPage.emailInputVisible();
		contactsLeadsPage.enterEmailInputData(email);
		contactsLeadsPage.phoneInputVisible();
		contactsLeadsPage.enterPhoneInputData(
			ContactsLeadsPageData.defaultPhone
		);
		contactsLeadsPage.countryInputVisible();
		contactsLeadsPage.enterCountryInputData(country);
		contactsLeadsPage.cityInputVisible();
		contactsLeadsPage.enterCityInputData(city);
		contactsLeadsPage.postcodeInputVisible();
		contactsLeadsPage.enterPostcodeInputData(postcode);
		contactsLeadsPage.streetInputVisible();
		contactsLeadsPage.enterStreetInputData(street);
		contactsLeadsPage.websiteInputVisible();
		contactsLeadsPage.enterWebsiteInputData(website);
		contactsLeadsPage.saveButtonVisible();
		contactsLeadsPage.clickSaveButton();
	});
	it('Should be able to delete lead', () => {
		contactsLeadsPage.waitMessageToHide();
		contactsLeadsPage.selectTableRow(0);
		contactsLeadsPage.deleteButtonVisible();
		contactsLeadsPage.clickDeleteButton();
		contactsLeadsPage.confirmDeleteButtonVisible();
		contactsLeadsPage.clickConfirmDeleteButton();
	});
});
