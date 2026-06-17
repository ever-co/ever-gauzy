import { test } from './support/fixtures';
import { getPage } from './support/page-context';
import * as loginPage from './support/pages/Login.po';
import { LoginPageData } from '../src/support/Base/pagedata/LoginPageData';
import * as customersPage from './support/pages/Customers.po';
import { faker } from '@faker-js/faker';
import { CustomersPageData } from '../src/support/Base/pagedata/CustomersPageData';
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

test.describe('Customers test', () => {
	test('Customers test', async () => {
		email = faker.internet.exampleEmail();
		fullName = faker.person.firstName() + ' ' + faker.person.lastName();
		deleteName = faker.person.firstName() + ' ' + faker.person.lastName();
		city = faker.location.city();
		postcode = faker.location.zipCode();
		street = faker.location.streetAddress();
		website = faker.internet.url();

		await CustomCommands.login(loginPage, LoginPageData, dashboardPage);

		await test.step('Should be able to add new customer', async () => {
			await CustomCommands.addProject(organizationProjectsPage, OrganizationProjectsPageData);
			await CustomCommands.addTag(organizationTagsUserPage, OrganizationTagsPageData);
			// addTag leaves us under the /pages/organization hash route. A goto() that only
			// changes the hash fragment (same origin+path) is a Playwright no-op, so force the
			// SPA hash router to switch to the customers route before interacting.
			await getPage().goto('/#/pages/contacts/customers');
			await getPage().evaluate(() => {
				if (!location.hash.includes('/pages/contacts/customers')) {
					location.hash = '#/pages/contacts/customers';
				}
			});
			// Wait until the customers screen has actually rendered before interacting —
			// otherwise the add-button click can land on the previous screen still mounted
			// during the hash-route transition. Use the route component (language-agnostic).
			await getPage()
				.locator('ngx-contacts-list')
				.first()
				.waitFor({ state: 'visible', timeout: 30000 });
			await customersPage.gridBtnExists();
			await customersPage.gridBtnClick(1);
			await customersPage.addButtonVisible();
			await customersPage.clickAddButton();
			await customersPage.nameInputVisible();
			await customersPage.enterNameInputData(fullName);
			await customersPage.emailInputVisible();
			await customersPage.enterEmailInputData(email);
			await customersPage.phoneInputVisible();
			await customersPage.enterPhoneInputData(CustomersPageData.defaultPhone);
			await customersPage.projectDropdownVisible();
			await customersPage.clickProjectDropdown();
			await customersPage.selectProjectFromDropdown(CustomersPageData.defaultProject);
			await customersPage.tagsMultiSelectVisible();
			await customersPage.clickTagsMultiSelect();
			await customersPage.selectTagsFromDropdown(0);
			await customersPage.clickCardBody();
			await customersPage.websiteInputVisible();
			await customersPage.enterWebsiteInputData(website);
			await customersPage.saveButtonVisible();
			await customersPage.clickSaveButton();
			await customersPage.countryDropdownVisible();
			await customersPage.clickCountryDropdown();
			await customersPage.selectCountryFromDropdown(CustomersPageData.country);
			await customersPage.cityInputVisible();
			await customersPage.enterCityInputData(city);
			await customersPage.postcodeInputVisible();
			await customersPage.enterPostcodeInputData(postcode);
			await customersPage.streetInputVisible();
			await customersPage.enterStreetInputData(street);
			// Address step -> Budget step
			await customersPage.verifyNextButtonVisible();
			await customersPage.clickNextButton();
			// Budget step (defaults are valid) -> Members step
			await customersPage.verifyNextButtonVisible();
			await customersPage.clickNextButton();
			await customersPage.selectEmployeeDropdownVisible();
			await customersPage.clickSelectEmployeeDropdown();
			await customersPage.selectEmployeeDropdownOption(0);
			await customersPage.clickKeyboardButtonByKeyCode(9);
			await customersPage.verifyFinishButtonVisible();
			await customersPage.clickFinishButton();
			await customersPage.waitMessageToHide();
			await customersPage.verifyCustomerExists(fullName);
		});

		await test.step('Should be able to invite customer', async () => {
			await customersPage.inviteButtonVisible();
			await customersPage.clickInviteButton();
			await customersPage.customerNameInputVisible();
			await customersPage.enterCustomerNameData(fullName);
			await customersPage.customerPhoneInputVisible();
			await customersPage.enterCustomerPhoneData(CustomersPageData.defaultPhone);
			await customersPage.customerEmailInputVisible();
			await customersPage.enterCustomerEmailData(email);
			await customersPage.saveInviteButtonVisible();
			await customersPage.clickSaveInviteButton();
			await customersPage.waitMessageToHide();
			await customersPage.verifyCustomerExists(fullName);
		});

		await test.step('Should be able to edit customer', async () => {
			await customersPage.tableRowVisible();
			await customersPage.selectTableRow(0);
			await customersPage.editButtonVisible();
			await customersPage.clickEditButton();
			await customersPage.nameInputVisible();
			await customersPage.enterNameInputData(deleteName);
			await customersPage.emailInputVisible();
			await customersPage.enterEmailInputData(email);
			await customersPage.phoneInputVisible();
			await customersPage.enterPhoneInputData(CustomersPageData.defaultPhone);
			await customersPage.websiteInputVisible();
			await customersPage.enterWebsiteInputData(website);
			await customersPage.saveButtonVisible();
			await customersPage.clickSaveButton();
			await customersPage.countryDropdownVisible();
			await customersPage.clickCountryDropdown();
			await customersPage.selectCountryFromDropdown(CustomersPageData.country);
			await customersPage.cityInputVisible();
			await customersPage.enterCityInputData(city);
			await customersPage.postcodeInputVisible();
			await customersPage.enterPostcodeInputData(postcode);
			await customersPage.streetInputVisible();
			await customersPage.enterStreetInputData(street);
			// Address step -> Budget step
			await customersPage.verifyNextButtonVisible();
			await customersPage.clickNextButton();
			// Budget step -> Members step
			await customersPage.verifyNextButtonVisible();
			await customersPage.clickNextButton();
			await customersPage.verifyFinishButtonVisible();
			await customersPage.clickFinishButton();
			await customersPage.waitMessageToHide();
			await customersPage.verifyCustomerExists(deleteName);
		});

		await test.step('Should be able to delete customer', async () => {
			await customersPage.selectTableRow(0);
			await customersPage.deleteButtonVisible();
			await customersPage.clickDeleteButton();
			await customersPage.confirmDeleteButtonVisible();
			await customersPage.clickConfirmDeleteButton();
			await customersPage.waitMessageToHide();
			await customersPage.verifyElementIsDeleted(deleteName);
		});
	});
});
