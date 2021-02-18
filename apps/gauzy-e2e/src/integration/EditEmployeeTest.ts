import * as loginPage from '../support/Base/pages/Login.po';
import { LoginPageData } from '../support/Base/pagedata/LoginPageData';
import * as editEmployeePage from '../support/Base/pages/EditEmployee.po';
import { EditEmployeePageData } from '../support/Base/pagedata/EditEmployeePageData';
import * as dashboradPage from '../support/Base/pages/Dashboard.po';
import { CustomCommands } from '../support/commands';
import * as faker from 'faker';
import * as manageEmployeesPage from '../support/Base/pages/ManageEmployees.po';
import * as organizationProjectsPage from '../support/Base/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../support/Base/pagedata/OrganizationProjectsPageData';
import * as contactsLeadsPage from '../support/Base/pages/ContactsLeads.po';
import { ContactsLeadsPageData } from '../support/Base/pagedata/ContactsLeadsPageData';
import * as organizationTagsUserPage from '../support/Base/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../support/Base/pagedata/OrganizationTagsPageData';

let firstName = ' ';
let lastName = ' ';
let username = ' ';
let password = ' ';
let employeeEmail = ' ';
let imgUrl = ' ';
let city = ' ';
let postcode = ' ';
let street = ' ';
let email = ' ';
let fullName = ' ';
let contactCity = ' ';
let contactPostcode = ' ';
let contactStreet = ' ';
let website = ' ';
let editUsername = ' ';
let editFirstName = ' ';
let editLastName = ' ';
let editEmail = ' ';

describe('Edit employee test', () => {
	before(() => {
		firstName = faker.name.firstName();
		lastName = faker.name.lastName();
		username = faker.internet.userName();
		password = faker.internet.password();
		email = faker.internet.email();
		employeeEmail = faker.internet.email();
		fullName = faker.name.firstName() + ' ' + faker.name.lastName();
		imgUrl = faker.image.avatar();
		city = faker.address.city();
		postcode = faker.address.zipCode();
		street = faker.address.streetAddress();
		editUsername = faker.internet.userName();
		editFirstName = faker.name.firstName();
		editLastName = faker.name.lastName();
		editEmail = faker.internet.email();
		contactCity = faker.address.city();
		contactPostcode = faker.address.zipCode();
		contactStreet = faker.address.streetAddress();

		CustomCommands.login(loginPage, LoginPageData, dashboradPage);
		CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
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
			contactCity,
			contactPostcode,
			contactStreet,
			website,
			contactsLeadsPage,
			ContactsLeadsPageData
		);
	});

	it('Should edit account data', () => {
		cy.visit('/#/pages/dashboard/accounting');
		editEmployeePage.selectEmployeeByName(`${firstName} ${lastName}`);
		editEmployeePage.editButtonVisible();
		editEmployeePage.clickEditButton();
		editEmployeePage.usernameInputVisible();
		editEmployeePage.enterUsernameInputData(editUsername);
		editEmployeePage.emailInputVisible();
		editEmployeePage.enterEmailData(editEmail);
		editEmployeePage.firstNameInputVisible();
		editEmployeePage.enterFirstNameData(editFirstName);
		editEmployeePage.lastNameInputVisible();
		editEmployeePage.enterLastNameData(editLastName);
		editEmployeePage.languageSelectVisible();
		editEmployeePage.chooseLanguage(EditEmployeePageData.preferredLanguage);
		editEmployeePage.tabButtonVisible();
		editEmployeePage.clickTabButton(1);
	});
	it('Should edit network data', () => {
		editEmployeePage.linkedinInputVisible();
		editEmployeePage.enterLinkedinInputData(EditEmployeePageData.linkedin);
		editEmployeePage.githubInputVisible();
		editEmployeePage.enterGithubInputData(EditEmployeePageData.github);
		editEmployeePage.upworkInputVisible();
		editEmployeePage.enterUpworkInputData(EditEmployeePageData.upwork);
		editEmployeePage.tabButtonVisible();
		editEmployeePage.clickTabButton(2);
	});
	it('Should edit employment data', () => {
		editEmployeePage.descriptionInputVisible();
		editEmployeePage.enterDescriptionInputData(
			EditEmployeePageData.description
		);
		editEmployeePage.clickTabButton(3);
	});
	it('Should edit hiring data', () => {
		editEmployeePage.offerDateInputVisible();
		editEmployeePage.enterOfferDateData();
		editEmployeePage.acceptDateInputVisible();
		editEmployeePage.enterAcceptDateData();
		editEmployeePage.clickTabButton(4);
	});
	it('Should edit location data', () => {
		editEmployeePage.countryDropdownVisible();
		editEmployeePage.clickCountryDropdown();
		editEmployeePage.selectCountryFromDropdown(
			EditEmployeePageData.country
		);
		editEmployeePage.cityInputVisible();
		editEmployeePage.enterCityInputData(city);
		editEmployeePage.postcodeInputVisible();
		editEmployeePage.enterPostcodeInputData(postcode);
		editEmployeePage.streetInputVisible();
		editEmployeePage.enterStreetInputData(street);
		editEmployeePage.clickTabButton(5);
	});
	it('Should edit rates data', () => {
		editEmployeePage.payPeriodDropdownVisible();
		editEmployeePage.clickPayPeriodDropdown();
		editEmployeePage.selectPayPeriodOption(EditEmployeePageData.payPeriod);
		editEmployeePage.weeklyLimitInputVisible();
		editEmployeePage.enterWeeklyLimitInputData(
			EditEmployeePageData.weeklyLimits
		);
		editEmployeePage.billRateInputVisible();
		editEmployeePage.enterBillRateInputData(EditEmployeePageData.billRate);
		editEmployeePage.clickTabButton(6);
	});
	it('Should edit projects data', () => {
		editEmployeePage.addProjectOrContactButtonVisible();
		editEmployeePage.clickAddProjectOrContactButton();
		editEmployeePage.projectOrContactDropdownVisible();
		editEmployeePage.clickProjectOrContactDropdown();
		editEmployeePage.selectProjectOrContactFromDropdown(0);
		editEmployeePage.saveProjectOrContactButtonVisible();
		editEmployeePage.clickSaveProjectOrContactButton();
		editEmployeePage.verifyProjectOrContactExist();
		editEmployeePage.clickTabButton(7);
	});
	it('Should edit contacts data', () => {
		editEmployeePage.addProjectOrContactButtonVisible();
		editEmployeePage.clickAddProjectOrContactButton();
		editEmployeePage.projectOrContactDropdownVisible();
		editEmployeePage.clickProjectOrContactDropdown();
		editEmployeePage.selectProjectOrContactFromDropdown(0);
		editEmployeePage.saveProjectOrContactButtonVisible();
		editEmployeePage.clickSaveProjectOrContactButton();
		editEmployeePage.verifyProjectOrContactExist();
		editEmployeePage.clickTabButton(0);
		editEmployeePage.saveBtnExists();
		editEmployeePage.saveBtnClick();
		editEmployeePage.waitMessageToHide();
		editEmployeePage.verifyEmployee(`${firstName} ${lastName}`);
	});
});
