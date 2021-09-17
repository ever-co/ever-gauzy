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
import 'cypress-file-upload';
import '@4tw/cypress-drag-drop';

const pageLoadTimeout = Cypress.config('pageLoadTimeout');

export const CustomCommands = {
	login: (loginPage: any, LoginPageData: any, dashboardPage: any) => {
		cy.visit('/', { timeout: pageLoadTimeout });
		loginPage.verifyTitle();
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(LoginPageData.email);
		loginPage.clearPasswordField();
		loginPage.enterPassword(LoginPageData.password);
		loginPage.clickLoginButton();
		dashboardPage.verifyCreateButton();
	},
	addTag: (organizationTagsUserPage: any, OrganizationTagsPageData: any) => {
		cy.visit('/#/pages/organization/tags', { timeout: pageLoadTimeout });
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
		fullName: string,
		email: string,
		city: string,
		postcode: string,
		street: string,
		website: string,
		contactsLeadsPage: any,
		ContactsLeadsPageData: any
	) => {
		cy.visit('/#/pages/contacts/leads', { timeout: pageLoadTimeout });
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
		contactsLeadsPage.projectDropdownVisible();
		contactsLeadsPage.clickProjectDropdown();
		contactsLeadsPage.selectProjectFromDropdown(
			ContactsLeadsPageData.defaultProject
		);
		contactsLeadsPage.tagsMultiSelectVisible();
		contactsLeadsPage.clickTagsMultiSelect();
		contactsLeadsPage.selectTagsFromDropdown(0);
		contactsLeadsPage.clickCardBody();
		contactsLeadsPage.websiteInputVisible();
		contactsLeadsPage.enterWebsiteInputData(website);
		contactsLeadsPage.saveButtonVisible();
		contactsLeadsPage.clickSaveButton();
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
		contactsLeadsPage.verifyNextButtonVisible();
		contactsLeadsPage.clickNextButton();
		contactsLeadsPage.budgetInputVisible();
		contactsLeadsPage.enterBudgetData(ContactsLeadsPageData.hours);
		contactsLeadsPage.lastStepBtnVisible();
		contactsLeadsPage.clickLastStepBtn();
		contactsLeadsPage.selectEmployeeDropdownVisible();
		contactsLeadsPage.clickSelectEmployeeDropdown();
		contactsLeadsPage.selectEmployeeDropdownOption(0);
		contactsLeadsPage.clickKeyboardButtonByKeyCode(9);
		contactsLeadsPage.verifyFinishButtonVisible();
		contactsLeadsPage.clickFinishButton();
	},
	addTeam: (organizationTeamsPage: any, OrganizationTeamsPageData: any) => {
		cy.visit('/#/pages/organization/teams', { timeout: pageLoadTimeout });
		organizationTeamsPage.gridBtnExists();
		organizationTeamsPage.gridBtnClick(1);
		organizationTeamsPage.addTeamButtonVisible();
		organizationTeamsPage.clickAddTeamButton();
		organizationTeamsPage.nameInputVisible();
		organizationTeamsPage.enterNameInputData(
			OrganizationTeamsPageData.name
		);
		organizationTeamsPage.tagsMultiSelectVisible();
		organizationTeamsPage.clickTagsMultiSelect();
		organizationTeamsPage.selectTagsFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.clickEmployeeDropdown();
		organizationTeamsPage.selectEmployeeFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.clickManagerDropdown();
		organizationTeamsPage.selectManagerFromDropdown(0);
		organizationTeamsPage.clickCardBody(0);
		organizationTeamsPage.saveButtonVisible();
		organizationTeamsPage.clickSaveButton();
	},
	addProject: (
		organizationProjectsPage: any,
		OrganizationProjectsPageData: any,
		employeeFullName?: string
	) => {
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		cy.visit('/#/pages/organization/projects', {
			timeout: pageLoadTimeout
		});
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
		if (!employeeFullName) {
			organizationProjectsPage.selectEmployeeDropdownOption(0);
		} else {
			organizationProjectsPage.selectEmployeeFromDropdownByName(
				employeeFullName
			);
		}
		organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
		organizationProjectsPage.clickTabButton(3);
		organizationProjectsPage.budgetHoursInputVisible();
		organizationProjectsPage.enterBudgetHoursInputData(
			OrganizationProjectsPageData.hours
		);
		organizationProjectsPage.clickTabButton(5);
		organizationProjectsPage.colorInputVisible();
		organizationProjectsPage.enterColorInputData(
			OrganizationProjectsPageData.color
		);
		organizationProjectsPage.saveProjectButtonVisible();
		organizationProjectsPage.clickSaveProjectButton();
	},
	addTask: (
		addTaskPage: any,
		AddTasksPageData: any,
		employeeFullName?: string
	) => {
		cy.visit('/#/pages/tasks/dashboard', { timeout: pageLoadTimeout });
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
		if (!employeeFullName) {
			addTaskPage.selectEmployeeDropdownOption(0);
		} else {
			addTaskPage.selectEmployeeFromDropdownByName(employeeFullName);
		}
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
		manageEmployeesPage: any,
		firstName: string,
		lastName: string,
		username: string,
		employeeEmail: string,
		password: string,
		imgUrl: string
	) => {
		cy.visit('/#/pages/employees', { timeout: pageLoadTimeout });
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
	},
	addClient: (
		clientsPage: any,
		fullName: string,
		email: string,
		website: string,
		city: string,
		postcode: string,
		street: string,
		ClientsData: any,
		employeeFullName?: string
	) => {
		cy.visit('/#/pages/contacts/clients', { timeout: pageLoadTimeout });
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
		clientsPage.projectDropdownVisible();
		clientsPage.clickProjectDropdown();
		clientsPage.selectProjectFromDropdown(ClientsData.defaultProject);
		clientsPage.tagsMultiSelectVisible();
		clientsPage.clickTagsMultiSelect();
		clientsPage.selectTagsFromDropdown(0);
		clientsPage.clickCardBody();
		clientsPage.websiteInputVisible();
		clientsPage.enterWebsiteInputData(website);
		clientsPage.saveButtonVisible();
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
		clientsPage.budgetInputVisible();
		clientsPage.enterBudgetData(ClientsData.hours);
		clientsPage.lastStepBtnVisible();
		clientsPage.clickLastStepBtn();
		clientsPage.selectEmployeeDropdownVisible();
		clientsPage.clickSelectEmployeeDropdown();
		if (!employeeFullName) {
			clientsPage.selectEmployeeDropdownOption(0);
		} else {
			clientsPage.selectEmployeeFromDropdownByName(employeeFullName);
		}
		clientsPage.clickKeyboardButtonByKeyCode(9);
		clientsPage.nextButtonVisible();
		clientsPage.clickNextButton();
		clientsPage.waitMessageToHide();
		clientsPage.verifyClientExists(fullName);
	},
	addOrganization: (
		addOrganizationPage: any,
		organizationName: string,
		AddOrganizationPageData: any,
		taxId: any,
		street: string
	) => {
		cy.visit('/#/pages/organizations', { timeout: pageLoadTimeout });
		addOrganizationPage.addBtnExists();
		addOrganizationPage.addBtnClick();
		addOrganizationPage.enterOrganizationName(organizationName);
		addOrganizationPage.selectCurrency(AddOrganizationPageData.currency);
		addOrganizationPage.enterOfficialName(organizationName);
		addOrganizationPage.enterTaxId(taxId);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.countryDropdownVisible();
		addOrganizationPage.clickCountryDropdown();
		addOrganizationPage.selectCountryFromDropdown(
			AddOrganizationPageData.country
		);
		addOrganizationPage.cityInputVisible();
		addOrganizationPage.enterCityInputData(AddOrganizationPageData.city);
		addOrganizationPage.postcodeInputVisible();
		addOrganizationPage.enterPostcodeInputData(
			AddOrganizationPageData.postcode
		);
		addOrganizationPage.streetInputVisible();
		addOrganizationPage.enterStreetInputData(street);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.bonusTypeDropdownVisible();
		addOrganizationPage.clickBonusTypeDropdown();
		addOrganizationPage.selectBonusTypeFromDropdown(
			AddOrganizationPageData.bonusType
		);
		addOrganizationPage.bonusPercentageInputVisible();
		addOrganizationPage.enterBonusPercentageInputData(
			AddOrganizationPageData.bonusPercentage
		);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.timeZoneDropdownVisible();
		addOrganizationPage.clickTimeZoneDropdown();
		addOrganizationPage.selectTimeZoneFromDropdown(
			AddOrganizationPageData.timeZone
		);
		addOrganizationPage.startOfWeekDropdownVisible();
		addOrganizationPage.clickStartOfWeekDropdown();
		addOrganizationPage.selectStartOfWeekFromDropdown(
			AddOrganizationPageData.startOfWeek
		);
		addOrganizationPage.dateTypeDropdownVisible();
		addOrganizationPage.clickDateTypeDropdown();
		addOrganizationPage.selectDateTypeFromDropdown(
			AddOrganizationPageData.dateType
		);
		addOrganizationPage.regionDropdownVisible();
		addOrganizationPage.clickRegionDropdown();
		addOrganizationPage.selectRegionFromDropdown(
			AddOrganizationPageData.region
		);
		addOrganizationPage.numberFormatDropdownVisible();
		addOrganizationPage.clickNumberFormatDropdown();
		addOrganizationPage.selectNumberFormatFromDropdown(
			AddOrganizationPageData.numberFormat
		);
		addOrganizationPage.dateFormatDropdownVisible();
		addOrganizationPage.clickDateFormatDropdown();
		addOrganizationPage.selectDateFormatFromDropdown();
		addOrganizationPage.expiryPeriodInputVisible();
		addOrganizationPage.enterExpiryPeriodInputData(
			AddOrganizationPageData.expiryPeriod
		);
		addOrganizationPage.clickOnNextButton();
		addOrganizationPage.waitMessageToHide();
		// addOrganizationPage.verifyOrganizationExists(organizationName);
	},
	addCandidate: (
		inviteCandidatePage: any,
		firstName: string,
		lastName: string,
		username: string,
		email: string,
		password: string,
		imgUrl: string
	) => {
		cy.visit('/#/pages/employees/candidates', { timeout: pageLoadTimeout });
		cy.on('uncaught:exception', (err, runnable) => {
			return false;
		});
		inviteCandidatePage.addCandidateButtonVisible();
		inviteCandidatePage.clickAddCandidateButton(0);
		inviteCandidatePage.firstNameInputVisible();
		inviteCandidatePage.enterFirstNameInputData(firstName);
		inviteCandidatePage.lastNameInputVisible();
		inviteCandidatePage.enterLastNameInputData(lastName);
		inviteCandidatePage.usernameInputVisible();
		inviteCandidatePage.enterUsernameInputData(username);
		inviteCandidatePage.candidateEmailInputVisible();
		inviteCandidatePage.enterCandidateEmailInputData(email);
		inviteCandidatePage.passwordInputVisible();
		inviteCandidatePage.enterPasswordInputData(password);
		inviteCandidatePage.candidateDateInputVisible();
		inviteCandidatePage.enterCandidateDateInputData();
		inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		inviteCandidatePage.tagsDropdownVisible();
		inviteCandidatePage.clickAddTagsDropdown();
		inviteCandidatePage.selectTagsFromDrodpwon(0);
		inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		inviteCandidatePage.imageInputvisible();
		inviteCandidatePage.enterImageInputData(imgUrl);
		inviteCandidatePage.nextButtonVisible();
		inviteCandidatePage.clickNextButton();
		inviteCandidatePage.nextStepButtonVisible();
		inviteCandidatePage.clickNextStepButton();
		inviteCandidatePage.allCurrentCandidatesButtonVisible();
		inviteCandidatePage.clickAllCurrentCandidatesButton();
		inviteCandidatePage.waitMessageToHide();
		// inviteCandidatePage.verifyCandidateExists(`${firstName} ${lastName}`);
	},
	clearCookies: () => {
		// @ts-ignore
		cy.clearCookies({ domain: null });
		cy.clearLocalStorage();
		cy.window().then((win) => {
			win.sessionStorage.clear();
		});
		cy.reload();
	},
	logout: (dashboradPage: any, logoutPage: any, loginPage: any) => {
		dashboradPage.clickUserName();
		logoutPage.clickLogoutButton();
		loginPage.verifyLoginText();
	},
	getIframeBody: (index: number) => {
		return cy
			.get('iframe[class="cke_wysiwyg_frame cke_reset"]')
			.its(`${index}.contentDocument.body`)
			.should('not.be.empty')
			.then(cy.wrap);
	},
	loginAsEmployee: (
		loginPage: any,
		dashboardPage: any,
		empEmail: string,
		empPassword: string
	) => {
		loginPage.verifyLoginText();
		loginPage.clearEmailField();
		loginPage.enterEmail(empEmail);
		loginPage.clearPasswordField();
		loginPage.enterPassword(empPassword);
		loginPage.clickLoginButton();
		dashboardPage.verifyCreateButton();
	},
	addTime: (timeTrackingPage: any, description: string, url: string) => {
		timeTrackingPage.waitMainDashboard(url);
		timeTrackingPage.timerVisible();
		timeTrackingPage.clickTimer();
		timeTrackingPage.timerBtnVisible();
		timeTrackingPage.clickTimerBtn(1);
		timeTrackingPage.clientSelectVisible();
		timeTrackingPage.clickClientSelect();
		timeTrackingPage.selectOptionFromDropdown(0);
		timeTrackingPage.projectSelectVisible();
		timeTrackingPage.clickProjectSelect();
		timeTrackingPage.selectOptionFromDropdown(0);
		timeTrackingPage.taskSelectVisible();
		timeTrackingPage.clickTaskSelect();
		timeTrackingPage.selectOptionFromDropdown(0);
		timeTrackingPage.descriptionInputVisible();
		timeTrackingPage.enterDescription(description);
		timeTrackingPage.startTimerBtnVisible();
		timeTrackingPage.clickStartTimerBtn();
		cy.wait(5000);
		timeTrackingPage.stopTimerBtnVisible();
		timeTrackingPage.clickStopTimerBtn();
		timeTrackingPage.startTimerBtnVisible();
		timeTrackingPage.closeBtnVisible();
		timeTrackingPage.clickCloseBtn();
	}
};
