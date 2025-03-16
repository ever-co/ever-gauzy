import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as customersPage from '../support/Base/pages/Customers.po';
import { faker } from '@faker-js/faker';
import { CustomersPageData } from '../support/Base/pagedata/CustomersPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
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

describe('Customers test', () => {
	before(() => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		deleteName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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
		customersPage.projectDropdownVisible();
		customersPage.clickProjectDropdown();
		customersPage.selectProjectFromDropdown(
			CustomersPageData.defaultProject
		);
		customersPage.tagsMultiSelectVisible();
		customersPage.clickTagsMultiSelect();
		customersPage.selectTagsFromDropdown(0);
		customersPage.clickCardBody();
		customersPage.websiteInputVisible();
		customersPage.enterWebsiteInputData(website);
		customersPage.saveButtonVisible();
		customersPage.clickSaveButton();
		customersPage.countryDropdownVisible();
		customersPage.clickCountryDropdown();
		customersPage.selectCountryFromDropdown(CustomersPageData.country);
		customersPage.cityInputVisible();
		customersPage.enterCityInputData(city);
		customersPage.postcodeInputVisible();
		customersPage.enterPostcodeInputData(postcode);
		customersPage.streetInputVisible();
		customersPage.enterStreetInputData(street);
		customersPage.verifyNextButtonVisible();
		customersPage.clickNextButton();
		customersPage.selectEmployeeDropdownVisible();
		customersPage.clickSelectEmployeeDropdown();
		customersPage.selectEmployeeDropdownOption(0);
		customersPage.clickKeyboardButtonByKeyCode(9);
		customersPage.verifyFinishButtonVisible();
		customersPage.clickFinishButton();
		customersPage.waitMessageToHide();
		customersPage.verifyCustomerExists(fullName);
	});
	it('Should be able to invite customer', () => {
		customersPage.inviteButtonVisible();
		customersPage.clickInviteButton();
		customersPage.customerNameInputVisible();
		customersPage.enterCustomerNameData(fullName);
		customersPage.customerPhoneInputVisible();
		customersPage.enterCustomerPhoneData(CustomersPageData.defaultPhone);
		customersPage.customerEmailInputVisible();
		customersPage.enterCustomerEmailData(email);
		customersPage.saveInviteButtonVisible();
		customersPage.clickSaveInviteButton();
		customersPage.waitMessageToHide();
		customersPage.verifyCustomerExists(fullName);
	});
	it('Should be able to edit customer', () => {
		customersPage.tableRowVisible();
		customersPage.selectTableRow(0);
		customersPage.editButtonVisible();
		customersPage.clickEditButton();
		customersPage.nameInputVisible();
		customersPage.enterNameInputData(deleteName);
		customersPage.emailInputVisible();
		customersPage.enterEmailInputData(email);
		customersPage.phoneInputVisible();
		customersPage.enterPhoneInputData(CustomersPageData.defaultPhone);
		customersPage.websiteInputVisible();
		customersPage.enterWebsiteInputData(website);
		customersPage.saveButtonVisible();
		customersPage.clickSaveButton();
		customersPage.countryDropdownVisible();
		customersPage.clickCountryDropdown();
		customersPage.selectCountryFromDropdown(CustomersPageData.country);
		customersPage.cityInputVisible();
		customersPage.enterCityInputData(city);
		customersPage.postcodeInputVisible();
		customersPage.enterPostcodeInputData(postcode);
		customersPage.streetInputVisible();
		customersPage.enterStreetInputData(street);
		customersPage.verifyNextButtonVisible();
		customersPage.clickNextButton();
		customersPage.verifyFinishButtonVisible();
		customersPage.clickFinishButton();
		customersPage.waitMessageToHide();
		customersPage.verifyCustomerExists(deleteName);
	});
	it('Should be able to delete customer', () => {
		customersPage.selectTableRow(0);
		customersPage.deleteButtonVisible();
		customersPage.clickDeleteButton();
		customersPage.confirmDeleteButtonVisible();
		customersPage.clickConfirmDeleteButton();
		customersPage.waitMessageToHide();
		customersPage.verifyElementIsDeleted(deleteName);
	});
});
