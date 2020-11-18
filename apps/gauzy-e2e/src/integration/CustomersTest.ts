import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as customersPage from '../support/Base/pages/Customers.po';
import * as faker from 'faker';
import { CustomersPageData } from '../support/Base/pagedata/CustomersPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import { CustomCommands } from '../support/commands';

let email = ' ';
let fullName = ' ';
let country = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

describe('Customers test', () => {
	before(() => {
		email = faker.internet.email();
		fullName = faker.name.firstName() + ' ' + faker.name.lastName();
		country = faker.address.country();
		city = faker.address.city();
		postcode = faker.address.zipCode();
		street = faker.address.streetAddress();
		website = faker.internet.url();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
	});

	it('Should be able to add new customer', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/contacts/customers');
		customersPage.gridBtnExists();
		customersPage.gridBtnClick(1);
		customersPage.addButtonVisible();
		customersPage.clickAddButton();
		customersPage.nameInputVisible();
		customersPage.enterNameInputData(fullName);
		customersPage.emailInputVisible();
		customersPage.enterEmailInputData(email);
		customersPage.phoneInputVisible();
		customersPage.enterPhoneInputData(CustomersPageData.defaultPhone);
		customersPage.countryInputVisible();
		customersPage.enterCountryInputData(country);
		customersPage.cityInputVisible();
		customersPage.enterCityInputData(city);
		customersPage.postcodeInputVisible();
		customersPage.enterPostcodeInputData(postcode);
		customersPage.streetInputVisible();
		customersPage.enterStreetInputData(street);
		customersPage.projectDropdownVisible();
		customersPage.clickProjectDropdown();
		customersPage.selectProjectFromDropdown(
			CustomersPageData.defaultProject
		);
		customersPage.selectEmployeeDropdownVisible();
		customersPage.clickSelectEmployeeDropdown();
		customersPage.selectEmployeeDropdownOption(0);
		customersPage.clickKeyboardButtonByKeyCode(9);
		customersPage.tagsMultyselectVisible();
		customersPage.clickTagsMultyselect();
		customersPage.selectTagsFromDropdown(0);
		customersPage.clickCardBody();
		customersPage.websiteInputVisible();
		customersPage.enterWebsiteInputData(website);
		customersPage.saveButtonVisible();
		customersPage.clickSaveButton();
	});
	it('Should be able to invite customer', () => {
		customersPage.waitMessageToHide();
		customersPage.inviteButtonVisible();
		customersPage.clickInviteButton();
		customersPage.customerNameInputVisible();
		customersPage.enterCustomerNameData(fullName);
		customersPage.customerPhoneInputVisible();
		customersPage.enterCustomerPhoneData(CustomersPageData.defaultPhone);
		customersPage.customerEmailInputVisible();
		customersPage.enterCustomerEmailData(email);
		customersPage.saveInvitebuttonVisible();
		customersPage.clickSaveInviteButton();
	});
	it('Should be able to edit customer', () => {
		customersPage.waitMessageToHide();
		customersPage.tableRowVisible();
		customersPage.selectTableRow(0);
		customersPage.editButtonVisible();
		customersPage.clickEditButton();
		customersPage.nameInputVisible();
		customersPage.enterNameInputData(fullName);
		customersPage.emailInputVisible();
		customersPage.enterEmailInputData(email);
		customersPage.phoneInputVisible();
		customersPage.enterPhoneInputData(CustomersPageData.defaultPhone);
		customersPage.countryInputVisible();
		customersPage.enterCountryInputData(country);
		customersPage.cityInputVisible();
		customersPage.enterCityInputData(city);
		customersPage.postcodeInputVisible();
		customersPage.enterPostcodeInputData(postcode);
		customersPage.streetInputVisible();
		customersPage.enterStreetInputData(street);
		customersPage.websiteInputVisible();
		customersPage.enterWebsiteInputData(website);
		customersPage.saveButtonVisible();
		customersPage.clickSaveButton();
	});
	it('Should be able to delete customer', () => {
		customersPage.waitMessageToHide();
		customersPage.selectTableRow(0);
		customersPage.deleteButtonVisible();
		customersPage.clickDeleteButton();
		customersPage.confirmDeleteButtonVisible();
		customersPage.clickConfirmDeleteButton();
	});
});
