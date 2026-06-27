import { test } from './support/fixtures';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as clientsPage from './support/pages/Clients.po';
import { faker } from '@faker-js/faker';
import { ClientsData } from '../src/support/Base/pagedata/ClientsPageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import { CustomCommands } from './support/commands';

let email = ' ';
let fullName = ' ';
let inviteName = ' ';
let deleteName = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let website = ' ';

test.describe('Clients test', () => {
	test('Clients test', async () => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		inviteName = faker.person.firstName() + ' ' + faker.person.lastName();
		deleteName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new client', async () => {
			await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			await CustomCommands.addClient(
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

		await test.step('Should be able to invite client', async () => {
			await clientsPage.inviteButtonVisible();
			await clientsPage.clickInviteButton();
			await clientsPage.contactNameInputVisible();
			await clientsPage.enterClientNameData(inviteName);
			await clientsPage.clientPhoneInputVisible();
			await clientsPage.enterClientPhoneData(ClientsData.defaultPhone);
			await clientsPage.clientEmailInputVisible();
			await clientsPage.enterClientEmailData(email);
			await clientsPage.saveInviteButtonVisible();
			await clientsPage.clickSaveInviteButton();
			await clientsPage.waitMessageToHide();
			await clientsPage.verifyClientExists(inviteName);
		});

		await test.step('Should be able to edit client', async () => {
			await clientsPage.tableRowVisible();
			await clientsPage.selectTableRow(0);
			await clientsPage.editButtonVisible();
			await clientsPage.clickEditButton();
			await clientsPage.nameInputVisible();
			await clientsPage.enterNameInputData(deleteName);
			await clientsPage.emailInputVisible();
			await clientsPage.enterEmailInputData(email);
			await clientsPage.phoneInputVisible();
			await clientsPage.enterPhoneInputData(ClientsData.defaultPhone);
			await clientsPage.saveButtonVisible();
			await clientsPage.websiteInputVisible();
			await clientsPage.enterWebsiteInputData(website);
			// re-set Name last (raw): filling website re-triggers the form's Name-reset, else the rename
			// silently saves the original name.
			await clientsPage.reenterNameInputData(deleteName);
			await clientsPage.clickSaveButton();
			await clientsPage.countryDropdownVisible();
			await clientsPage.clickCountryDropdown();
			await clientsPage.selectCountryFromDropdown(ClientsData.country);
			await clientsPage.cityInputVisible();
			await clientsPage.enterCityInputData(city);
			await clientsPage.postcodeInputVisible();
			await clientsPage.enterPostcodeInputData(postcode);
			await clientsPage.streetInputVisible();
			await clientsPage.enterStreetInputData(street);
			// location (2) → budget (3) → employees (4) → finish: the edit reopens the same 4-step
			// contact-mutation stepper as add, so it must traverse budget + employees, not next→next.
			await clientsPage.nextButtonVisible();
			await clientsPage.clickNextButton();
			await clientsPage.budgetInputVisible();
			await clientsPage.enterBudgetData(ClientsData.hours);
			await clientsPage.lastStepBtnVisible();
			await clientsPage.clickLastStepBtn();
			await clientsPage.selectEmployeeDropdownVisible();
			await clientsPage.clickSelectEmployeeDropdown();
			await clientsPage.selectEmployeeDropdownOption(0);
			await clientsPage.clickKeyboardButtonByKeyCode(9);
			await clientsPage.nextButtonVisible();
			await clientsPage.clickNextButton();
			await clientsPage.waitMessageToHide();
			await clientsPage.verifyClientExists(deleteName);
		});

		await test.step('Should be able to delete client', async () => {
			await clientsPage.tableRowVisible();
			await clientsPage.selectTableRow(0);
			await clientsPage.deleteButtonVisible();
			await clientsPage.clickDeleteButton();
			await clientsPage.confirmDeleteButtonVisible();
			await clientsPage.clickConfirmDeleteButton();
			await clientsPage.waitMessageToHide();
			await clientsPage.verifyElementIsDeleted(deleteName);
		});
	});
});
