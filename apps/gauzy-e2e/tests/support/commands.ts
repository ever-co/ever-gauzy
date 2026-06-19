import { getPage } from './page-context';

/**
 * Ported Cypress CustomCommands (src/support/commands.ts) → Playwright.
 *
 * The signatures are kept IDENTICAL to the Cypress originals (page objects +
 * data passed in as args, typed `any`) so the spec migration stays mechanical:
 * a ported spec just `await`s each command and swaps its imports. Internally
 * every command is async and awaits the (now-async) page-object methods.
 *
 * Cypress → Playwright translations applied here:
 *   cy.visit(url, {timeout})            -> await getPage().goto(url)
 *   cy.wait(ms)                         -> await getPage().waitForTimeout(ms)
 *   cy.on('uncaught:exception', ...)    -> dropped (Playwright doesn't fail on page errors)
 *   cy.clearCookies/clearLocalStorage   -> context().clearCookies() / evaluate(localStorage.clear)
 *   cy.window().then(win => ...)         -> getPage().evaluate(() => ...)
 *   cy.reload()                         -> getPage().reload()
 */
/**
 * Robust hash navigation for the setup commands. A hash-only goto() issued right after a previous
 * screen can be a same-document no-op (Playwright doesn't reload, the Angular hash-router never
 * re-renders), so the next generic "+ Add" click lands on the PREVIOUS page and re-opens its dialog
 * (the "wrong dialog open" cascade). Force the hash route when goto() didn't take, then let the new
 * screen settle. Scoped to these setup commands — NOT a global page.goto hook — so it can't disturb
 * specs that navigate on their own (a global override regressed clean specs and was reverted).
 */
const gotoRoute = async (route: string): Promise<void> => {
	const page = getPage();
	await page.goto(route);
	const hash = route.includes('#') ? route.slice(route.indexOf('#')) : '';
	if (hash) {
		// Compare WITHOUT query params: the app appends e.g. ?date=... to the hash, so a naive
		// equality check wrongly concludes we're off-route and force-reassigns location.hash — a
		// spurious SECOND navigation that races the first and leaves the previous overlay mounted.
		// Only force the hash when the PATH genuinely differs (a real same-document no-op).
		await page.evaluate((h) => {
			if (location.hash.split('?')[0] !== h) location.hash = h;
		}, hash);
		// Let the SPA route fully render before the caller interacts (don't click mid-transition).
		await page.waitForTimeout(700);
	}
};

export const CustomCommands = {
	login: async (loginPage: any, LoginPageData: any, dashboardPage: any) => {
		await getPage().goto('/');
		await loginPage.verifyTitle();
		await loginPage.verifyLoginText();
		await loginPage.clearEmailField();
		await loginPage.enterEmail(LoginPageData.email);
		await loginPage.clearPasswordField();
		await loginPage.enterPassword(LoginPageData.password);
		await loginPage.clickLoginButton();
		await dashboardPage.verifyCreateButton();
	},
	addTag: async (organizationTagsUserPage: any, OrganizationTagsPageData: any) => {
		// The tags page may share the /pages/organization/ shell with a preceding
		// setup step (e.g. addProject). When the current route already lives under the
		// same path+origin (only the hash fragment differs), Playwright's goto() is a
		// no-op and the SPA router never sees the new route, so the previous screen
		// stays mounted and the generic success-button click lands on its "Add" button.
		// Drive the hash change in-page (Angular's hash router reacts to `hashchange`),
		// then wait until the tags grid header is visible before interacting.
		await gotoRoute('/#/pages/organization/tags');
		await getPage().evaluate(() => {
			if (!location.hash.includes('/pages/organization/tags')) {
				location.hash = '#/pages/organization/tags';
			}
		});
		await getPage()
			.locator('h4.card-header-title:has-text("Tags")')
			.first()
			.waitFor({ state: 'visible', timeout: 30000 });
		await organizationTagsUserPage.gridButtonVisible();
		await organizationTagsUserPage.clickGridButton(1);
		await organizationTagsUserPage.addTagButtonVisible();
		await organizationTagsUserPage.clickAddTagButton();
		await organizationTagsUserPage.tagNameInputVisible();
		await organizationTagsUserPage.enterTagNameData(OrganizationTagsPageData.tagName);
		await organizationTagsUserPage.tagColorInputVisible();
		await organizationTagsUserPage.enterTagColorData(OrganizationTagsPageData.tagColor);
		await organizationTagsUserPage.tagDescriptionTextareaVisible();
		await organizationTagsUserPage.enterTagDescriptionData(OrganizationTagsPageData.tagDescription);
		await organizationTagsUserPage.saveTagButtonVisible();
		await organizationTagsUserPage.clickSaveTagButton();
		// Ensure the Add Tags dialog actually closes before the caller navigates away; nb-dialog
		// overlays can otherwise survive the SPA route change and block the next screen's controls
		// (the root cause of the "wrong dialog is open" cascade seen in level/position/tasks specs).
		// If the save raced (Save briefly disabled while the reactive form validated -> the forced
		// click was a no-op), the dialog lingers, so dismiss it explicitly with Escape.
		const page = getPage();
		const tagDialogInput = page.locator('#inputName').first();
		const tagDialogClosed = await tagDialogInput
			.waitFor({ state: 'hidden', timeout: 12000 })
			.then(() => true)
			.catch(() => false);
		if (!tagDialogClosed) {
			await page.keyboard.press('Escape').catch(() => undefined);
			await tagDialogInput.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => undefined);
		}
		// The input can already be hidden while the nb-dialog OVERLAY is still fading out; that fading
		// overlay survives a fast subsequent navigation and blocks the next screen. Wait for the dialog
		// component itself to fully detach before returning so the caller's next goto/click is clean.
		await page.locator('ngx-tags-mutation').first().waitFor({ state: 'detached', timeout: 6000 }).catch(() => undefined);
	},
	addContact: async (
		fullName: string,
		email: string,
		city: string,
		postcode: string,
		street: string,
		website: string,
		contactsLeadsPage: any,
		ContactsLeadsPageData: any
	) => {
		await gotoRoute('/#/pages/contacts/leads');
		await contactsLeadsPage.gridBtnExists();
		await contactsLeadsPage.gridBtnClick(1);
		await contactsLeadsPage.addButtonVisible();
		await contactsLeadsPage.clickAddButton();
		await contactsLeadsPage.nameInputVisible();
		await contactsLeadsPage.enterNameInputData(fullName);
		await contactsLeadsPage.emailInputVisible();
		await contactsLeadsPage.enterEmailInputData(email);
		await contactsLeadsPage.phoneInputVisible();
		await contactsLeadsPage.enterPhoneInputData(ContactsLeadsPageData.defaultPhone);
		await contactsLeadsPage.projectDropdownVisible();
		await contactsLeadsPage.clickProjectDropdown();
		await contactsLeadsPage.selectProjectFromDropdown(ContactsLeadsPageData.defaultProject);
		await contactsLeadsPage.tagsMultiSelectVisible();
		await contactsLeadsPage.clickTagsMultiSelect();
		await contactsLeadsPage.selectTagsFromDropdown(0);
		await contactsLeadsPage.clickCardBody();
		await contactsLeadsPage.websiteInputVisible();
		await contactsLeadsPage.enterWebsiteInputData(website);
		// The contact-mutation form resets the Name control whenever an earlier field is
		// cleared-then-filled (an Angular re-render on valueChanges), leaving step 1 invalid and the
		// stepper's Next disabled. Re-set Name as the last action before advancing — raw fill, no
		// clearField, so it doesn't re-trigger the reset.
		await getPage().locator('[formcontrolname="name"]').first().fill(fullName);
		await contactsLeadsPage.saveButtonVisible();
		await contactsLeadsPage.clickSaveButton();
		await contactsLeadsPage.countryDropdownVisible();
		await contactsLeadsPage.clickCountryDropdown();
		await contactsLeadsPage.selectCountryFromDropdown(ContactsLeadsPageData.country);
		await contactsLeadsPage.cityInputVisible();
		await contactsLeadsPage.enterCityInputData(city);
		await contactsLeadsPage.postcodeInputVisible();
		await contactsLeadsPage.enterPostcodeInputData(postcode);
		await contactsLeadsPage.streetInputVisible();
		await contactsLeadsPage.enterStreetInputData(street);
		await contactsLeadsPage.verifyNextButtonVisible();
		await contactsLeadsPage.clickNextButton();
		await contactsLeadsPage.budgetInputVisible();
		await contactsLeadsPage.enterBudgetData(ContactsLeadsPageData.hours);
		await contactsLeadsPage.lastStepBtnVisible();
		await contactsLeadsPage.clickLastStepBtn();
		await contactsLeadsPage.selectEmployeeDropdownVisible();
		await contactsLeadsPage.clickSelectEmployeeDropdown();
		await contactsLeadsPage.selectEmployeeDropdownOption(0);
		await contactsLeadsPage.clickKeyboardButtonByKeyCode(9);
		await contactsLeadsPage.verifyFinishButtonVisible();
		await contactsLeadsPage.clickFinishButton();
	},
	addTeam: async (organizationTeamsPage: any, OrganizationTeamsPageData: any) => {
		await gotoRoute('/#/pages/organization/teams');
		await organizationTeamsPage.gridBtnExists();
		await organizationTeamsPage.gridBtnClick(1);
		await organizationTeamsPage.addTeamButtonVisible();
		await organizationTeamsPage.clickAddTeamButton();
		await organizationTeamsPage.nameInputVisible();
		await organizationTeamsPage.enterNameInputData(OrganizationTeamsPageData.name);
		await organizationTeamsPage.tagsMultiSelectVisible();
		await organizationTeamsPage.clickTagsMultiSelect();
		await organizationTeamsPage.selectTagsFromDropdown(0);
		await organizationTeamsPage.clickCardBody(0);
		await organizationTeamsPage.clickEmployeeDropdown(1);
		await organizationTeamsPage.selectEmployeeFromDropdown(0);
		await organizationTeamsPage.clickCardBody(0);
		await organizationTeamsPage.clickManagerDropdown(1);
		await organizationTeamsPage.selectManagerFromDropdown(0);
		await organizationTeamsPage.clickCardBody(0);
		await organizationTeamsPage.saveButtonVisible();
		await organizationTeamsPage.clickSaveButton();
	},
	addProject: async (
		organizationProjectsPage: any,
		OrganizationProjectsPageData: any,
		employeeFullName?: string
	) => {
		await gotoRoute('/#/pages/organization/projects');
		await organizationProjectsPage.gridBtnExists();
		await organizationProjectsPage.gridBtnClick(1);
		await organizationProjectsPage.requestProjectButtonVisible();
		await organizationProjectsPage.clickRequestProjectButton();
		await organizationProjectsPage.nameInputVisible();
		await organizationProjectsPage.enterNameInputData(OrganizationProjectsPageData.name);
		await organizationProjectsPage.selectEmployeeDropdownVisible();
		await organizationProjectsPage.clickSelectEmployeeDropdown();
		if (!employeeFullName) {
			await organizationProjectsPage.selectEmployeeDropdownOption(0);
		} else {
			await organizationProjectsPage.selectEmployeeFromDropdownByName(employeeFullName);
		}
		await organizationProjectsPage.clickKeyboardButtonByKeyCode(9);
		await organizationProjectsPage.clickTabButton(3);
		await organizationProjectsPage.budgetHoursInputVisible();
		await organizationProjectsPage.enterBudgetHoursInputData(OrganizationProjectsPageData.hours);
		await organizationProjectsPage.clickTabButton(5);
		await organizationProjectsPage.colorInputVisible();
		await organizationProjectsPage.enterColorInputData(OrganizationProjectsPageData.color);
		await organizationProjectsPage.saveProjectButtonVisible();
		await organizationProjectsPage.clickSaveProjectButton();
	},
	addTask: async (addTaskPage: any, AddTasksPageData: any, employeeFullName?: string) => {
		await gotoRoute('/#/pages/tasks/dashboard');
		await addTaskPage.gridBtnExists();
		await addTaskPage.gridBtnClick(1);
		await addTaskPage.addTaskButtonVisible();
		await addTaskPage.clickAddTaskButton();
		await addTaskPage.selectProjectDropdownVisible();
		await addTaskPage.clickSelectProjectDropdown();
		await addTaskPage.selectProjectOptionDropdown(AddTasksPageData.defaultTaskProject);
		await addTaskPage.selectEmployeeDropdownVisible();
		await addTaskPage.clickSelectEmployeeDropdown();
		if (!employeeFullName) {
			await addTaskPage.selectEmployeeDropdownOption(0);
		} else {
			await addTaskPage.selectEmployeeFromDropdownByName(employeeFullName);
		}
		await addTaskPage.clickKeyboardButtonByKeyCode(9);
		await addTaskPage.addTitleInputVisible();
		await addTaskPage.enterTitleInputData(AddTasksPageData.defaultTaskTitle);
		await addTaskPage.dueDateInputVisible();
		await addTaskPage.enterDueDateData();
		await addTaskPage.clickKeyboardButtonByKeyCode(9);
		await addTaskPage.estimateDaysInputVisible();
		await addTaskPage.enterEstimateDaysInputData(AddTasksPageData.defaultTaskEstimateDays);
		await addTaskPage.estimateHoursInputVisible();
		await addTaskPage.enterEstimateHoursInputData(AddTasksPageData.defaultTaskEstimateHours);
		await addTaskPage.estimateMinutesInputVisible();
		await addTaskPage.enterEstimateMinutesInputData(AddTasksPageData.defaultTaskEstimateMinutes);
		await addTaskPage.taskDescriptionTextareaVisible();
		await addTaskPage.enterTaskDescriptionTextareaData(AddTasksPageData.defaultTaskDescription);
		await addTaskPage.saveTaskButtonVisible();
		await addTaskPage.clickSaveTaskButton();
	},
	addEmployee: async (
		manageEmployeesPage: any,
		firstName: string,
		lastName: string,
		username: string,
		employeeEmail: string,
		password: string,
		imgUrl: string
	) => {
		// Flow rewritten for the current app: the employee add is now a simple quick-add
		// ("+ Create" -> Full Name + Email -> "Add"), replacing the old multi-step
		// firstName/username/password/date/image/tags wizard. username/password/imgUrl are unused now.
		void username;
		void password;
		void imgUrl;
		await gotoRoute('/#/pages/employees');
		await getPage().locator('button.create').first().click();
		await getPage().locator('input[placeholder="Full Name"]').first().fill(`${firstName} ${lastName}`);
		await getPage().locator('input[placeholder="Email"]').first().fill(employeeEmail);
		await getPage().locator('input[placeholder="Email"]').first().press('Tab');
		await getPage().getByRole('button', { name: 'Add', exact: true }).first().click({ force: true });
		await getPage().waitForTimeout(2500);
	},
	addClient: async (
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
		await gotoRoute('/#/pages/contacts/clients');
		await clientsPage.gridBtnExists();
		await clientsPage.gridBtnClick(1);
		await clientsPage.addButtonVisible();
		await clientsPage.clickAddButton();
		await clientsPage.nameInputVisible();
		await clientsPage.enterNameInputData(fullName);
		await clientsPage.emailInputVisible();
		await clientsPage.enterEmailInputData(email);
		await clientsPage.phoneInputVisible();
		await clientsPage.enterPhoneInputData(ClientsData.defaultPhone);
		await clientsPage.projectDropdownVisible();
		await clientsPage.clickProjectDropdown();
		await clientsPage.selectProjectFromDropdown(ClientsData.defaultProject);
		await clientsPage.tagsMultiSelectVisible();
		await clientsPage.clickTagsMultiSelect();
		await clientsPage.selectTagsFromDropdown(0);
		await clientsPage.clickCardBody();
		await clientsPage.websiteInputVisible();
		await clientsPage.enterWebsiteInputData(website);
		// Same contact-mutation Name-reset quirk as addContact: re-set Name (raw fill) before advancing.
		await getPage().locator('[formcontrolname="name"]').first().fill(fullName);
		await clientsPage.saveButtonVisible();
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
		await clientsPage.nextButtonVisible();
		await clientsPage.clickNextButton();
		await clientsPage.budgetInputVisible();
		await clientsPage.enterBudgetData(ClientsData.hours);
		await clientsPage.lastStepBtnVisible();
		await clientsPage.clickLastStepBtn();
		await clientsPage.selectEmployeeDropdownVisible();
		await clientsPage.clickSelectEmployeeDropdown();
		if (!employeeFullName) {
			await clientsPage.selectEmployeeDropdownOption(0);
		} else {
			await clientsPage.selectEmployeeFromDropdownByName(employeeFullName);
		}
		await clientsPage.clickKeyboardButtonByKeyCode(9);
		await clientsPage.nextButtonVisible();
		await clientsPage.clickNextButton();
		await clientsPage.waitMessageToHide();
		await clientsPage.verifyNameInput();
		await clientsPage.searchClientName(fullName);
		await clientsPage.verifySearchResult(1);
		await clientsPage.verifyClientExists(fullName);
		await clientsPage.clearSearchInput();
	},
	addOrganization: async (
		addOrganizationPage: any,
		organizationName: string,
		AddOrganizationPageData: any,
		taxId: any,
		street: string
	) => {
		await gotoRoute('/#/pages/organizations');
		await addOrganizationPage.addBtnExists();
		await addOrganizationPage.addBtnClick();
		await addOrganizationPage.enterOrganizationName(organizationName);
		await addOrganizationPage.selectCurrency(AddOrganizationPageData.currency);
		await addOrganizationPage.enterOfficialName(organizationName);
		await addOrganizationPage.enterTaxId(taxId);
		await addOrganizationPage.clickOnNextButton();
		await addOrganizationPage.countryDropdownVisible();
		await addOrganizationPage.clickCountryDropdown();
		await addOrganizationPage.selectCountryFromDropdown(AddOrganizationPageData.country);
		await addOrganizationPage.cityInputVisible();
		await addOrganizationPage.enterCityInputData(AddOrganizationPageData.city);
		await addOrganizationPage.postcodeInputVisible();
		await addOrganizationPage.enterPostcodeInputData(AddOrganizationPageData.postcode);
		await addOrganizationPage.streetInputVisible();
		await addOrganizationPage.enterStreetInputData(street);
		await addOrganizationPage.clickOnNextButton();
		await addOrganizationPage.bonusTypeDropdownVisible();
		await addOrganizationPage.clickBonusTypeDropdown();
		await addOrganizationPage.selectBonusTypeFromDropdown(AddOrganizationPageData.bonusType);
		await addOrganizationPage.bonusPercentageInputVisible();
		await addOrganizationPage.enterBonusPercentageInputData(AddOrganizationPageData.bonusPercentage);
		await addOrganizationPage.clickOnNextButton();
		await addOrganizationPage.timeZoneDropdownVisible();
		await addOrganizationPage.clickTimeZoneDropdown();
		await addOrganizationPage.selectTimeZoneFromDropdown(AddOrganizationPageData.timeZone);
		await addOrganizationPage.startOfWeekDropdownVisible();
		await addOrganizationPage.clickStartOfWeekDropdown();
		await addOrganizationPage.selectStartOfWeekFromDropdown(AddOrganizationPageData.startOfWeek);
		await addOrganizationPage.dateTypeDropdownVisible();
		await addOrganizationPage.clickDateTypeDropdown();
		await addOrganizationPage.selectDateTypeFromDropdown(AddOrganizationPageData.dateType);
		await addOrganizationPage.regionDropdownVisible();
		await addOrganizationPage.clickRegionDropdown();
		await addOrganizationPage.selectRegionFromDropdown(AddOrganizationPageData.region);
		await addOrganizationPage.numberFormatDropdownVisible();
		await addOrganizationPage.clickNumberFormatDropdown();
		await addOrganizationPage.selectNumberFormatFromDropdown(AddOrganizationPageData.numberFormat);
		await addOrganizationPage.dateFormatDropdownVisible();
		await addOrganizationPage.clickDateFormatDropdown();
		await addOrganizationPage.selectDateFormatFromDropdown();
		await addOrganizationPage.expiryPeriodInputVisible();
		await addOrganizationPage.enterExpiryPeriodInputData(AddOrganizationPageData.expiryPeriod);
		await addOrganizationPage.clickOnNextButton();
		await addOrganizationPage.waitMessageToHide();
		// addOrganizationPage.verifyOrganizationExists(organizationName);
	},
	addCandidate: async (
		inviteCandidatePage: any,
		firstName: string,
		lastName: string,
		username: string,
		email: string,
		password: string,
		imgUrl: string
	) => {
		await gotoRoute('/#/pages/employees/candidates');
		await inviteCandidatePage.addCandidateButtonVisible();
		await inviteCandidatePage.clickAddCandidateButton(0);
		await inviteCandidatePage.firstNameInputVisible();
		await inviteCandidatePage.enterFirstNameInputData(firstName);
		await inviteCandidatePage.lastNameInputVisible();
		await inviteCandidatePage.enterLastNameInputData(lastName);
		await inviteCandidatePage.usernameInputVisible();
		await inviteCandidatePage.enterUsernameInputData(username);
		await inviteCandidatePage.candidateEmailInputVisible();
		await inviteCandidatePage.enterCandidateEmailInputData(email);
		await inviteCandidatePage.passwordInputVisible();
		await inviteCandidatePage.enterPasswordInputData(password);
		await inviteCandidatePage.candidateDateInputVisible();
		await inviteCandidatePage.enterCandidateDateInputData();
		await inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		await inviteCandidatePage.tagsDropdownVisible();
		await inviteCandidatePage.clickAddTagsDropdown();
		await inviteCandidatePage.selectTagsFromDropdown(0);
		await inviteCandidatePage.clickKeyboardButtonByKeyCode(9);
		await inviteCandidatePage.imageInputVisible();
		await inviteCandidatePage.enterImageInputData(imgUrl);
		await inviteCandidatePage.nextButtonVisible();
		await inviteCandidatePage.clickNextButton();
		await inviteCandidatePage.nextStepButtonVisible();
		await inviteCandidatePage.clickNextStepButton();
		await inviteCandidatePage.allCurrentCandidatesButtonVisible();
		await inviteCandidatePage.clickAllCurrentCandidatesButton();
		await inviteCandidatePage.waitMessageToHide();
		// inviteCandidatePage.verifyCandidateExists(`${firstName} ${lastName}`);
	},
	clearCookies: async () => {
		await getPage().context().clearCookies();
		await getPage().evaluate(() => {
			localStorage.clear();
			sessionStorage.clear();
		});
		await getPage().reload();
	},
	logout: async (dashboardPage: any, logoutPage: any, loginPage: any) => {
		await dashboardPage.clickUserName();
		await logoutPage.clickLogoutButton();
		await loginPage.verifyLoginText();
	},
	getIframeBody: (index: number) => {
		// CKEditor iframe; Playwright addresses frames via frameLocator.
		return getPage()
			.frameLocator('iframe.cke_wysiwyg_frame.cke_reset')
			.nth(index)
			.locator('body');
	},
	loginAsEmployee: async (loginPage: any, dashboardPage: any, empEmail: string, empPassword: string) => {
		await loginPage.verifyLoginText();
		await loginPage.clearEmailField();
		await loginPage.enterEmail(empEmail);
		await loginPage.clearPasswordField();
		await loginPage.enterPassword(empPassword);
		await loginPage.clickLoginButton();
		await dashboardPage.verifyCreateButton();
	},
	addTime: async (timeTrackingPage: any, description: string, url: string) => {
		await timeTrackingPage.waitMainDashboard(url);
		await timeTrackingPage.timerVisible();
		await timeTrackingPage.clickTimer();
		await timeTrackingPage.timerBtnVisible();
		await timeTrackingPage.clickTimerBtn(1);
		await timeTrackingPage.clientSelectVisible();
		await timeTrackingPage.clickClientSelect();
		await timeTrackingPage.selectOptionFromDropdown(0);
		await timeTrackingPage.projectSelectVisible();
		await timeTrackingPage.clickProjectSelect();
		await timeTrackingPage.selectOptionFromDropdown(0);
		await timeTrackingPage.taskSelectVisible();
		await timeTrackingPage.clickTaskSelect();
		await timeTrackingPage.selectOptionFromDropdown(0);
		await timeTrackingPage.descriptionInputVisible();
		await timeTrackingPage.enterDescription(description);
		await timeTrackingPage.startTimerBtnVisible();
		await timeTrackingPage.clickStartTimerBtn();
		await getPage().waitForTimeout(5000);
		await timeTrackingPage.stopTimerBtnVisible();
		await timeTrackingPage.clickStopTimerBtn();
		await timeTrackingPage.startTimerBtnVisible();
		await timeTrackingPage.closeBtnVisible();
		await timeTrackingPage.clickCloseBtn();
	}
};
