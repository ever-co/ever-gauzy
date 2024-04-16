import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as clientsPage from '../support/Base/pages/Clients.po';
import { faker } from '@faker-js/faker';
import { ClientsData } from '../support/Base/pagedata/ClientsPageData';
import * as dashboardPage from '../support/Base/pages/Dashboard.po';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from '../support/commands';

let email = ' ';
let fullName = ' ';
let inviteName = ' ';
let deleteName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

describe('Clients test', () => {
	before(() => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		inviteName = faker.person.firstName() + ' ' + faker.person.lastName();
		deleteName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();

		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
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
		CustomCommands.addClient(
			clientsPage,
			fullName,
			email,
			website,
			city,
			postcode,
			street,
			ClientsData
		);
	});
	it('Should be able to invite client', () => {
		clientsPage.inviteButtonVisible();
		clientsPage.clickInviteButton();
		clientsPage.contactNameInputVisible();
		clientsPage.enterClientNameData(inviteName);
		clientsPage.clientPhoneInputVisible();
		clientsPage.enterClientPhoneData(ClientsData.defaultPhone);
		clientsPage.clientEmailInputVisible();
		clientsPage.enterClientEmailData(email);
		clientsPage.saveInviteButtonVisible();
		clientsPage.clickSaveInviteButton();
		clientsPage.waitMessageToHide();
		clientsPage.verifyClientExists(inviteName);
	});
	it('Should be able to edit client', () => {
		clientsPage.tableRowVisible();
		clientsPage.selectTableRow(0);
		clientsPage.editButtonVisible();
		clientsPage.clickEditButton();
		clientsPage.nameInputVisible();
		clientsPage.enterNameInputData(deleteName);
		clientsPage.emailInputVisible();
		clientsPage.enterEmailInputData(email);
		clientsPage.phoneInputVisible();
		clientsPage.enterPhoneInputData(ClientsData.defaultPhone);
		clientsPage.saveButtonVisible();
		clientsPage.websiteInputVisible();
		clientsPage.enterWebsiteInputData(website);
		clientsPage.clickSaveButton();
		clientsPage.countryDropdownVisible();
		clientsPage.clickCountryDropdown();
		clientsPage.selectCountryFromDropdown(ClientsData.country);
		clientsPage.cityInputVisible();
		clientsPage.enterCityInputData(city);
		clientsPage.postcodeInputVisible();
		clientsPage.enterPostcodeInputData(postcode);
		clientsPage.streetInputVisible();
		clientsPage.enterStreetInputData(street);
		clientsPage.nextButtonVisible();
		clientsPage.clickNextButton();
		clientsPage.clickNextButton();
		clientsPage.waitMessageToHide();
		clientsPage.verifyClientExists(deleteName);
	});
	it('Should be able to delete client', () => {
		clientsPage.tableRowVisible();
		clientsPage.selectTableRow(0);
		clientsPage.deleteButtonVisible();
		clientsPage.clickDeleteButton();
		clientsPage.confirmDeleteButtonVisible();
		clientsPage.clickConfirmDeleteButton();
		clientsPage.waitMessageToHide();
		clientsPage.verifyElementIsDeleted(deleteName);
	});
});
