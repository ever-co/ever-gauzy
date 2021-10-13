import * as loginPage from '../../Base/pages/Login.po';
import { LoginPageData } from '../../Base/pagedata/LoginPageData';
import * as organizationHelpCenterPage from '../../Base/pages/OrganizationHelpCenter.po';
import { OrganizationHelpCenterPageData } from '../../Base/pagedata/OrganizationHelpCenterPageData';
import * as dashboardPage from '../../Base/pages/Dashboard.po';
import { CustomCommands } from '../../commands';
import * as faker from 'faker';
import * as manageEmployeesPage from '../../Base/pages/ManageEmployees.po';
import * as logoutPage from '../../Base/pages/Logout.po';



import { Given, Then, When, And } from 'cypress-cucumber-preprocessor/steps';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

let articleName = faker.name.title();
let empFirstName = faker.name.firstName();
let empLastName = faker.name.lastName();
let empUsername = faker.internet.userName();
let empPassword = faker.internet.password();
let employeeEmail = faker.internet.email();
let empImgUrl = faker.image.avatar();
let desc = faker.lorem.words();
let articleText = faker.lorem.paragraph();
// Login with email
Given(
	'Login with default credentials',
	() => {
		CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	}
);

// Add new employee
And('User can add new employee', () => {
	CustomCommands.addEmployee(
		manageEmployeesPage,
		empFirstName,
		empLastName,
		empUsername,
		employeeEmail,
		empPassword,
		empImgUrl
	);
});

// Add base

Then('User visit Organization help center page',() => {
	CustomCommands.logout(dashboardPage, logoutPage, loginPage);
	CustomCommands.clearCookies();
	CustomCommands.login(loginPage, LoginPageData, dashboardPage);
	cy.visit('/#/pages/organization/help-center', { timeout: pageLoadTimeout });
});

And('User can see add button', () => {
	organizationHelpCenterPage.addButtonVisible();
});

When('User click on add button', () => {
	organizationHelpCenterPage.clickAddButton();
});

And('User can see publish button', () => {
	organizationHelpCenterPage.publishButtonVisible();
});

When('User click on publish  button', () => {
	organizationHelpCenterPage.clickPublishButton();
});

Then('User can see icon button', () => {
	organizationHelpCenterPage.iconDropdownVisible();
});

When('User click on icon button', () => {
	organizationHelpCenterPage.clickIconDropdown();
});

Then('User can select first item from dropdown', () => {
	organizationHelpCenterPage.selectIconFromDropdown(0);
});

And('User can see color input field', () => {
	organizationHelpCenterPage.colorInputVisible();
});

And('User can enter value for color', () => {
	organizationHelpCenterPage.enterColorInputData(
		OrganizationHelpCenterPageData.defaultColor
	);
});

And('User can see name input field', () => {
	organizationHelpCenterPage.nameInputVisible();
});

And('User can enter name', () => {
	organizationHelpCenterPage.enterNameInputData(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

And('User can see description input field', () => {
	organizationHelpCenterPage.descriptionInputVisible();
});

And('User can enter description', () => {
	organizationHelpCenterPage.enterDescriptionInputData(
		OrganizationHelpCenterPageData.defaultBaseDescription
	);
});

And('User can see save button', () => {
	organizationHelpCenterPage.saveButtonVisible();
});

When('User click on save button', () => {
	organizationHelpCenterPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationHelpCenterPage.waitMessageToHide();
});

And('User can verify base was created', () => {
	organizationHelpCenterPage.verifybaseExists(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

//Add category
And('User can see settings button', () => {
	organizationHelpCenterPage.settingsButtonVisible();
});

Then('User click on settings button', () => {
	organizationHelpCenterPage.clickSettingsButton(OrganizationHelpCenterPageData.settingsButton);
});

Then('User can see category button', () => {
	organizationHelpCenterPage.addCategoryOptionVisible();
});

When('User click on add category button', () => {
	organizationHelpCenterPage.clickAddCategotyOption(
		OrganizationHelpCenterPageData.addCategoryOption
	);
});

Then('User can see icon button', () => {
	organizationHelpCenterPage.iconDropdownVisible();
});

When('User click on icon button', () => {
	organizationHelpCenterPage.clickIconDropdown();
});

Then('User can select second item from dropdown', () => {
	organizationHelpCenterPage.selectIconFromDropdown(1);
});

And('User can see color input field', () => {
	organizationHelpCenterPage.colorInputVisible();
});

And('User can enter value for color', () => {
	organizationHelpCenterPage.enterColorInputData(
		OrganizationHelpCenterPageData.defaultColor
	);
});

And('User can see name input field', () => {
	organizationHelpCenterPage.nameInputVisible();
});

And('User can enter name', () => {
	organizationHelpCenterPage.enterNameInputData(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

And('User can see description input field', () => {
	organizationHelpCenterPage.descriptionInputVisible();
});

And('User can enter description', () => {
	organizationHelpCenterPage.enterDescriptionInputData(
		OrganizationHelpCenterPageData.defaultBaseDescription
	);
});

And('User can see save button', () => {
	organizationHelpCenterPage.saveButtonVisible();
});

When('User click on save button', () => {
	organizationHelpCenterPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationHelpCenterPage.waitMessageToHide();
});

And('User can see arrow button',() => {
	organizationHelpCenterPage.arrowButtonVisible();
});

Then('User click on arrow button', () => {
	organizationHelpCenterPage.clickArrowButton();
});

And('User can verify category was created', () => {
	organizationHelpCenterPage.verifyCategoryExists(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

//Add article
Then('User click on the category',() => {
	organizationHelpCenterPage.clickOnCategory(OrganizationHelpCenterPageData.categoryOption);
});

Then('User can see add article button', () => {
	organizationHelpCenterPage.verifyAddArticleButton(OrganizationHelpCenterPageData.addArticleButton);
});

When('User click on the add article button', () => {
	organizationHelpCenterPage.clickOnAddArticleButton(OrganizationHelpCenterPageData.addArticleButton);
});

And('User can see input for name of the article', () => {
	organizationHelpCenterPage.verifyNameOfTheArticleInput();
});

And('User can enter name of the article', () => {
	organizationHelpCenterPage.enterArticleName(articleName);
});

And('User can see input for description of the article', () => {
	organizationHelpCenterPage.verifyDescOfTheArticleInput();
});

And('User can enter description of the article', () => {
	organizationHelpCenterPage.enterDescName(desc);
})

And('User can see employee placeholder field', () => {
	organizationHelpCenterPage.verifyEmployeePlaceholderField(OrganizationHelpCenterPageData.employeePlaceholder);
});

And('User click employee placeholder field', () => {
	organizationHelpCenterPage.clickOnEmployeePlaceholderField(OrganizationHelpCenterPageData.employeePlaceholder);
})

Then('User can select employee from dropdown', () => {
	organizationHelpCenterPage.clickEmployeeDropdown(OrganizationHelpCenterPageData.employeeOption);
	organizationHelpCenterPage.clickOnEmployeePlaceholderField(OrganizationHelpCenterPageData.employeePlaceholder);
});

Then('User can see article text', () => {
	organizationHelpCenterPage.verifyArticleText();
})

When('User enter in article text', () => {
	organizationHelpCenterPage.enterArticleText(articleText);
});

Then('User can see article save button', () => {
	organizationHelpCenterPage.verifyArticleSaveBtn();
})

And('User click on article save button', () => {
	organizationHelpCenterPage.clickArticleSaveBtn();
})
// Edit base
And('User can see settings button', () => {
	organizationHelpCenterPage.settingsButtonVisible();
});

When('User click on settings button', () => {
	organizationHelpCenterPage.clickSettingsButton(OrganizationHelpCenterPageData.settingsButton);
});

Then('User can see edit button', () => {
	organizationHelpCenterPage.editBaseOptionVisible();
});

When('User click on edit button', () => {
	organizationHelpCenterPage.clickEditBaseOption(
		OrganizationHelpCenterPageData.editBaseOption
	);
});

Then('User can see color input field again', () => {
	organizationHelpCenterPage.colorInputVisible();
});

And('User can edit color', () => {
	organizationHelpCenterPage.enterColorInputData(
		OrganizationHelpCenterPageData.defaultColor
	);
});

And('User can see name input field again', () => {
	organizationHelpCenterPage.nameInputVisible();
});

And('User can edit name', () => {
	organizationHelpCenterPage.enterNameInputData(
		OrganizationHelpCenterPageData.defaultBaseName
	);
});

And('User can see description input field', () => {
	organizationHelpCenterPage.descriptionInputVisible();
});

And('User can edit description', () => {
	organizationHelpCenterPage.enterDescriptionInputData(
		OrganizationHelpCenterPageData.defaultBaseDescription
	);
});

And('User can see save edited base button', () => {
	organizationHelpCenterPage.saveButtonVisible();
});

When('User click on save edited base button', () => {
	organizationHelpCenterPage.clickSaveButton();
});

Then('Notification message will appear', () => {
	organizationHelpCenterPage.waitMessageToHide();
});

// Delete base
And('User can see settings button again', () => {
	organizationHelpCenterPage.settingsButtonVisible();
});

When('User click on settings button again', () => {
	organizationHelpCenterPage.clickSettingsButton(OrganizationHelpCenterPageData.settingsButton);
});

Then('User can see delete base option', () => {
	organizationHelpCenterPage.deleteBaseOptionVisible();
});

When('User click on delete base option', () => {
	organizationHelpCenterPage.clickDeleteBaseOption(
		OrganizationHelpCenterPageData.deleteBaseOption
	);
});

Then('User can see delete button', () => {
	organizationHelpCenterPage.deleteButtonVisible();
});

When('User click on delete button', () => {
	organizationHelpCenterPage.clickDeleteButton();
});

Then('Notification message will appear', () => {
	organizationHelpCenterPage.waitMessageToHide();
});