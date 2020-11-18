import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as clientsPage from '../support/Base/pages/Clients.po';
import * as faker from 'faker';
import { ClientsData } from '../support/Base/pagedata/ClientsPageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';

let email = ' ';
let fullName = ' ';
let country = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

describe('Clients test', () => {
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

	it('Should be able to add new client', () => {
		CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		cy.visit('/#/pages/contacts/clients');
		clientsPage.gridBtnExists();
		clientsPage.gridBtnClick(1);
		clientsPage.addButtonVisible();
		clientsPage.clickAddButton();
		clientsPage.nameInputVisible();
		clientsPage.enterNameInputData(fullName);
		clientsPage.emailInputVisible();
		clientsPage.enterEmailInputData(email);
		clientsPage.phoneInputVisible();
		clientsPage.enterPhoneInputData(ClientsData.defaultPhone);
		clientsPage.countryInputVisible();
		clientsPage.enterCountryInputData(country);
		clientsPage.cityInputVisible();
		clientsPage.enterCityInputData(city);
		clientsPage.postcodeInputVisible();
		clientsPage.enterPostcodeInputData(postcode);
		clientsPage.streetInputVisible();
		clientsPage.enterStreetInputData(street);
		clientsPage.projectDropdownVisible();
		clientsPage.clickProjectDropdown();
		clientsPage.selectProjectFromDropdown(ClientsData.defaultProject);
		clientsPage.selectEmployeeDropdownVisible();
		clientsPage.clickSelectEmployeeDropdown();
		clientsPage.selectEmployeeDropdownOption(0);
		clientsPage.clickKeyboardButtonByKeyCode(9);
		clientsPage.tagsMultyselectVisible();
		clientsPage.clickTagsMultyselect();
		clientsPage.selectTagsFromDropdown(0);
		clientsPage.clickCardBody();
		clientsPage.websiteInputVisible();
		clientsPage.enterWebsiteInputData(website);
		clientsPage.saveButtonVisible();
		clientsPage.clickSaveButton();
	});
	it('Should be able to invite client', () => {
		clientsPage.waitMessageToHide();
		clientsPage.inviteButtonVisible();
		clientsPage.clickInviteButton();
		clientsPage.contactNameInputVisible();
		clientsPage.enterClientNameData(fullName);
		clientsPage.clientPhoneInputVisible();
		clientsPage.enterClientPhoneData(ClientsData.defaultPhone);
		clientsPage.clientEmailInputVisible();
		clientsPage.enterClientEmailData(email);
		clientsPage.saveInvitebuttonVisible();
		clientsPage.clickSaveInviteButton();
	});
	it('Should be able to edit client', () => {
		clientsPage.waitMessageToHide();
		clientsPage.tableRowVisible();
		clientsPage.selectTableRow(0);
		clientsPage.editButtonVisible();
		clientsPage.clickEditButton();
		clientsPage.nameInputVisible();
		clientsPage.enterNameInputData(fullName);
		clientsPage.emailInputVisible();
		clientsPage.enterEmailInputData(email);
		clientsPage.phoneInputVisible();
		clientsPage.enterPhoneInputData(ClientsData.defaultPhone);
		clientsPage.countryInputVisible();
		clientsPage.enterCountryInputData(country);
		clientsPage.cityInputVisible();
		clientsPage.enterCityInputData(city);
		clientsPage.postcodeInputVisible();
		clientsPage.enterPostcodeInputData(postcode);
		clientsPage.streetInputVisible();
		clientsPage.enterStreetInputData(street);
		clientsPage.websiteInputVisible();
		clientsPage.enterWebsiteInputData(website);
		clientsPage.saveButtonVisible();
		clientsPage.clickSaveButton();
	});
	it('Should be able to delete client', () => {
		clientsPage.waitMessageToHide();
		clientsPage.selectTableRow(0);
		clientsPage.deleteButtonVisible();
		clientsPage.clickDeleteButton();
		clientsPage.confirmDeleteButtonVisible();
		clientsPage.clickConfirmDeleteButton();
	});
});
