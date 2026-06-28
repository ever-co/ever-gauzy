import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as editEmployeePage from './support/pages/EditEmployee.po';
import { EditEmployeePageData } from '../src/support/Base/pagedata/EditEmployeePageData';
import * as dashboardPage from './support/pages/Dashboard.po';
import { CustomCommands } from './support/commands';
import { faker } from '@faker-js/faker';
import * as manageEmployeesPage from './support/pages/ManageEmployees.po';
import * as organizationProjectsPage from './support/pages/OrganizationProjects.po';
import { OrganizationProjectsPageData } from '../src/support/Base/pagedata/OrganizationProjectsPageData';
import * as contactsLeadsPage from './support/pages/ContactsLeads.po';
import { ContactsLeadsPageData } from '../src/support/Base/pagedata/ContactsLeadsPageData';
import * as organizationTagsUserPage from './support/pages/OrganizationTags.po';
import { OrganizationTagsPageData } from '../src/support/Base/pagedata/OrganizationTagsPageData';

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

test.describe('Edit employee test', () => {
	test('Edit employee test', async () => {
		firstName = faker.person.firstName();
		lastName = faker.person.lastName();
		username = faker.internet.username();
		password = faker.internet.password();
		email = faker.internet.exampleEmail();
		employeeEmail = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		imgUrl = faker.image.avatar();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		editUsername = faker.internet.username();
		editFirstName = faker.person.firstName();
		editLastName = faker.person.lastName();
		editEmail = faker.internet.exampleEmail();
		contactCity = faker.location.city();
		contactPostcode = faker.location.zipCode();
		contactStreet = faker.location.streetAddress();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);
		await CustomCommands.addEmployee(
			manageEmployeesPage,
			firstName,
			lastName,
			username,
			employeeEmail,
			password,
			imgUrl
		);
		await CustomCommands.addProject(
			organizationProjectsPage,
			OrganizationProjectsPageData
		);
		await CustomCommands.addTag(
			organizationTagsUserPage,
			OrganizationTagsPageData
		);
		await CustomCommands.addContact(
			fullName,
			email,
			contactCity,
			contactPostcode,
			contactStreet,
			website,
			contactsLeadsPage,
			ContactsLeadsPageData
		);

		await test.step('Should edit account data', async () => {
			await getPage().goto('/#/pages/dashboard/accounting');
			await editEmployeePage.selectEmployeeByName(`${firstName} ${lastName}`);
			await editEmployeePage.editButtonVisible();
			await editEmployeePage.clickEditButton();
			await editEmployeePage.usernameInputVisible();
			await editEmployeePage.enterUsernameInputData(editUsername);
			await editEmployeePage.emailInputVisible();
			await editEmployeePage.enterEmailData(editEmail);
			await editEmployeePage.firstNameInputVisible();
			await editEmployeePage.enterFirstNameData(editFirstName);
			await editEmployeePage.lastNameInputVisible();
			await editEmployeePage.enterLastNameData(editLastName);
			await editEmployeePage.languageSelectVisible();
			await editEmployeePage.chooseLanguage(EditEmployeePageData.preferredLanguage);
			await editEmployeePage.tabButtonVisible();
			await editEmployeePage.clickTabButton(1);
		});

		await test.step('Should edit network data', async () => {
			await editEmployeePage.linkedinInputVisible();
			await editEmployeePage.enterLinkedinInputData(EditEmployeePageData.linkedin);
			await editEmployeePage.githubInputVisible();
			await editEmployeePage.enterGithubInputData(EditEmployeePageData.github);
			await editEmployeePage.upworkInputVisible();
			await editEmployeePage.enterUpworkInputData(EditEmployeePageData.upwork);
			await editEmployeePage.tabButtonVisible();
			await editEmployeePage.clickTabButton(2);
		});

		await test.step('Should edit employment data', async () => {
			await editEmployeePage.descriptionInputVisible();
			await editEmployeePage.enterDescriptionInputData(
				EditEmployeePageData.description
			);
			await editEmployeePage.clickTabButton(3);
		});

		await test.step('Should edit hiring data', async () => {
			await editEmployeePage.offerDateInputVisible();
			await editEmployeePage.enterOfferDateData();
			await editEmployeePage.acceptDateInputVisible();
			await editEmployeePage.enterAcceptDateData();
			await editEmployeePage.clickTabButton(4);
		});

		await test.step('Should edit location data', async () => {
			await editEmployeePage.countryDropdownVisible();
			await editEmployeePage.clickCountryDropdown();
			await editEmployeePage.selectCountryFromDropdown(
				EditEmployeePageData.country
			);
			await editEmployeePage.cityInputVisible();
			await editEmployeePage.enterCityInputData(city);
			await editEmployeePage.postcodeInputVisible();
			await editEmployeePage.enterPostcodeInputData(postcode);
			await editEmployeePage.streetInputVisible();
			await editEmployeePage.enterStreetInputData(street);
			await editEmployeePage.clickTabButton(5);
		});

		await test.step('Should edit rates data', async () => {
			await editEmployeePage.payPeriodDropdownVisible();
			await editEmployeePage.clickPayPeriodDropdown();
			await editEmployeePage.selectPayPeriodOption(EditEmployeePageData.payPeriod);
			await editEmployeePage.weeklyLimitInputVisible();
			await editEmployeePage.enterWeeklyLimitInputData(
				EditEmployeePageData.weeklyLimits
			);
			await editEmployeePage.billRateInputVisible();
			await editEmployeePage.enterBillRateInputData(EditEmployeePageData.billRate);
			await editEmployeePage.clickTabButton(6);
		});

		await test.step('Should edit projects data', async () => {
			await editEmployeePage.addProjectOrContactButtonVisible();
			await editEmployeePage.clickAddProjectOrContactButton();
			await editEmployeePage.projectOrContactDropdownVisible();
			await editEmployeePage.clickProjectOrContactDropdown();
			await editEmployeePage.selectProjectOrContactFromDropdown(0);
			await editEmployeePage.saveProjectOrContactButtonVisible();
			await editEmployeePage.clickSaveProjectOrContactButton();
			await editEmployeePage.verifyProjectOrContactExist();
			await editEmployeePage.clickTabButton(7);
		});

		await test.step('Should edit contacts data', async () => {
			await editEmployeePage.addProjectOrContactButtonVisible();
			await editEmployeePage.clickAddProjectOrContactButton();
			await editEmployeePage.projectOrContactDropdownVisible();
			await editEmployeePage.clickProjectOrContactDropdown();
			await editEmployeePage.selectProjectOrContactFromDropdown(0);
			await editEmployeePage.saveProjectOrContactButtonVisible();
			await editEmployeePage.clickSaveProjectOrContactButton();
			await editEmployeePage.verifyProjectOrContactExist();
			await editEmployeePage.clickTabButton(0);
			await editEmployeePage.saveBtnExists();
			await editEmployeePage.saveBtnClick();
			await editEmployeePage.waitMessageToHide();
			// Verify the EDITED name, not the original: the Account step changed firstName/lastName to
			// editFirstName/editLastName, the save persists them, and the profile header
			// (span.employee-name binds selectedEmployee.user.name) re-renders with the new name after
			// the employee reloads. Asserting the original name would mismatch the now-edited header.
			await editEmployeePage.verifyEmployee(`${editFirstName} ${editLastName}`);
		});
	});
});
