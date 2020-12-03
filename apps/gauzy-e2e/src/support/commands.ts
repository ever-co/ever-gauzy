// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

export const CustomCommands = {
	login: (loginPage, LoginPageData, dashboradPage) => {
		cy.visit('/');
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboradPage.verifyCreateButton();
	},
	addTag: (organizationTagsUserPage, OrganizationTagsPageData) => {
		cy.visit('/#/pages/organization/tags');
		organizationTagsUserPage.gridButtonVisible();
		organizationTagsUserPage.clickGridButton(1);
		organizationTagsUserPage.addTagButtonVisible();
		organizationTagsUserPage.clickAddTagButton();
		organizationTagsUserPage.tagNameInputVisible();
		organizationTagsUserPage.enterTagNameData(
			OrganizationTagsPageData.tagName
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
	},
	addContact: (
		fullName,
		email,
		city,
		postcode,
		street,
		website,
		contactsLeadsPage,
		ContactsLeadsPageData
	) => {
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
		contactsLeadsPage.countryDropdownVisible();
		contactsLeadsPage.clickCountryDropdown();
		contactsLeadsPage.selectCountryFromDropdown(
			ContactsLeadsPageData.country
		);
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
	},
	addTeam: (organizationTeamsPage, OrganizationTeamsPageData) => {
		cy.visit('/#/pages/organization/teams');
		organizationTeamsPage.gridBtnExists();
		organizationTeamsPage.gridBtnClick(1);
		organizationTeamsPage.addTeamButtonVisible();
		organizationTeamsPage.clickAddTeamButton();
		organizationTeamsPage.nameInputVisible();
		organizationTeamsPage.enterNameInputData(
			OrganizationTeamsPageData.name
		);
		organizationTeamsPage.tagsMultyselectVisible();
		organizationTeamsPage.clickTagsMultyselect();
		organizationTeamsPage.selectTagsFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.clickEmployeeDropdown();
		organizationTeamsPage.selectEmployeeFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.clickManagerDropdown();
		organizationTeamsPage.selectManagerFromDropdown(0);
		organizationTeamsPage.clickCardBody();
		organizationTeamsPage.saveButtonVisible();
		organizationTeamsPage.clickSaveButton();
	},
	addProject: (organizationProjectsPage, OrganizationProjectsPageData) => {
		cy.visit('/#/pages/organization/projects');
		organizationProjectsPage.gridBtnExists();
		organizationProjectsPage.gridBtnClick(1);
		organizationProjectsPage.requestProjectButtonVisible();
		organizationProjectsPage.clickRequestProjectButton();
		organizationProjectsPage.nameInputVisible();
		organizationProjectsPage.enterNameInputData(
			OrganizationProjectsPageData.name
		);
		organizationProjectsPage.selectEmployeeDropdownVisible();
		organizationProjectsPage.clickSelectEmployeeDropdown();
		organizationProjectsPage.selectEmployeeDropdownOption(0);
		organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
		organizationProjectsPage.tagsMultyselectVisible();
		organizationProjectsPage.clickTagsMultyselect();
		organizationProjectsPage.selectTagsFromDropdown(0);
		organizationProjectsPage.clickCardBody();
		organizationProjectsPage.colorInputVisible();
		organizationProjectsPage.enterColorInputData(
			OrganizationProjectsPageData.color
		);
		organizationProjectsPage.descriptionInputVisible();
		organizationProjectsPage.enterDescriptionInputData(
			OrganizationProjectsPageData.description
		);
		organizationProjectsPage.saveProjectButtonVisible();
		organizationProjectsPage.clickSaveProjectButton();
	},
	addTask: (addTaskPage, AddTasksPageData) => {
		cy.visit('/#/pages/tasks/dashboard');
		addTaskPage.gridBtnExists();
		addTaskPage.gridBtnClick(1);
		addTaskPage.addTaskButtonVisible();
		addTaskPage.clickAddTaskButton();
		addTaskPage.selectProjectDropdownVisible();
		addTaskPage.clickSelectProjectDropdown();
		addTaskPage.selectProjectOptionDropdown(
			AddTasksPageData.defaultTaskProject
		);
		addTaskPage.selectEmployeeDropdownVisible();
		addTaskPage.clickSelectEmployeeDropdown();
		addTaskPage.selectEmployeeDropdownOption(1);
		addTaskPage.selectEmployeeDropdownOption(2);
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.addTitleInputVisible();
		addTaskPage.enterTitleInputData(AddTasksPageData.defaultTaskTitle);
		addTaskPage.dueDateInputVisible();
		addTaskPage.enterDueDateData();
		addTaskPage.clickKeyboardButtonByKeyCode(9);
		addTaskPage.estimateDaysInputVisible();
		addTaskPage.enterEstiamteDaysInputData(
			AddTasksPageData.defaultTaskEstimateDays
		);
		addTaskPage.estimateHoursInputVisible();
		addTaskPage.enterEstiamteHoursInputData(
			AddTasksPageData.defaultTaskEstimateHours
		);
		addTaskPage.estimateMinutesInputVisible();
		addTaskPage.enterEstimateMinutesInputData(
			AddTasksPageData.defaultTaskEstimateMinutes
		);
		addTaskPage.taskDecriptionTextareaVisible();
		addTaskPage.enterTaskDescriptionTextareaData(
			AddTasksPageData.defaultTaskDescription
		);
		addTaskPage.saveTaskButtonVisible();
		addTaskPage.clickSaveTaskButton();
	},
	addEmployee: (
		manageEmployeesPage,
		firstName,
		lastName,
		username,
		employeeEmail,
		password,
		imgUrl
	) => {
		cy.visit('/#/pages/employees');
		cy.wait(3000);
		manageEmployeesPage.addEmployeeButtonVisible();
		manageEmployeesPage.clickAddEmployeeButton();
		manageEmployeesPage.firstNameInputVisible();
		manageEmployeesPage.enterFirstNameData(firstName);
		manageEmployeesPage.lastNameInputVisible();
		manageEmployeesPage.enterLastNameData(lastName);
		manageEmployeesPage.usernameInputVisible();
		manageEmployeesPage.enterUsernameData(username);
		manageEmployeesPage.employeeEmailInputVisible();
		manageEmployeesPage.enterEmployeeEmailData(employeeEmail);
		manageEmployeesPage.dateInputVisible();
		manageEmployeesPage.enterDateData();
		manageEmployeesPage.clickKeyboardButtonByKeyCode(9);
		manageEmployeesPage.passwordInputVisible();
		manageEmployeesPage.enterPasswordInputData(password);
		manageEmployeesPage.tagsDropdownVisible();
		manageEmployeesPage.clickTagsDropdwon();
		manageEmployeesPage.selectTagFromDropdown(0);
		manageEmployeesPage.clickCardBody();
		manageEmployeesPage.imageInputVisible();
		manageEmployeesPage.enterImageDataUrl(imgUrl);
		manageEmployeesPage.nextButtonVisible();
		manageEmployeesPage.clickNextButton();
		manageEmployeesPage.nextStepButtonVisible();
		manageEmployeesPage.clickNextStepButton();
		manageEmployeesPage.lastStepButtonVisible();
		manageEmployeesPage.clickLastStepButton();
	}
};
