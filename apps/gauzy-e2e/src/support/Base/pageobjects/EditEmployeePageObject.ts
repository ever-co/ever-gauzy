export const EditEmployeePage = {
	// Accounting dashboard's per-employee breakdown (a15f8536cd, #10327 replaced the old
	// `div.block-info` employee blocks): one `div.breakdown-row[role=row]` per working employee whose
	// (click) selects that employee and opens the HR dashboard. The header and totals rows share the
	// class, so they are excluded.
	employeeCss:
		'ga-dashboard-accounting div.breakdown-row[role="row"]:not(.breakdown-row--head):not(.breakdown-row--total)',
	// HR dashboard identity bar's edit button (33e3c09f30, #10125 replaced `nb-icon.edit-icon`):
	// (click)="edit()" -> /pages/employees/edit/<id>.
	editButtonCss: 'ga-human-resources button.identity-edit',
	usernameInputCss: '#usernameInput',
	tabButtonCss: 'nb-route-tabset > ul.route-tabset > li.route-tab',
	firstNameInputCss: '#firstNameInput',
	lastNameInputCss: '#lastNameInput',
	emailInputCss: '#emailInput',
	preferredLanguageCss: 'ngx-language-selector ng-select',
	dropdownOptionCss: '.option-list nb-option, .ng-option',
	linkedInInputCss: '#linkedIn',
	githubInputCss: '#github',
	upworkInputCss: '#upwork',
	descriptionInputCss: '#shortDescription',
	offerDateInputCss: '#offerDateInput',
	acceptDateInputCss: '#acceptDateInput',
	countryDropdownCss: 'ga-country ng-select',
	cityInputCss: '#cityInput',
	postCodeInputCss: '#postcodeInput',
	addressInputCss: '#addressInput',
	payPeriodDropdownCss: '#payPeriodsSelect',
	weeklyLimitInputCss: '#reWeeklyLimitInput',
	billRateValueInputCss: '#billRateValueInput',
	projectOrContactsDropdownCss: '#departmentsSelect',
	projectOrContactDropdownOptionCss: 'div.ng-option',
	// Projects / Contacts tabs = <ga-edit-employee-membership> (redesigned in 17125da2e8, #10115):
	// header "+ Add" opens the add form; its own "Add" (submitForm -> entitiesAdded) persists the pick;
	// the employee's entities are listed as `ul.membership__list > li.membership__row`.
	addProjectOrContactButtonCss: 'ga-edit-employee-membership header.membership__header > button[status="success"]',
	saveProjectOrContactButtonCss: 'ga-edit-employee-membership .membership__add-actions > button[status="success"]',
	verifyProjectOrContactCss: 'ga-edit-employee-membership ul.membership__list > li.membership__row',
	// Account tab's Save (17125da2e8, #10115 moved it from `div.actions` into `footer.account__actions`).
	saveButtonCss: 'ga-edit-employee-main footer.account__actions > button[status="success"]',
	verifyEmployeeCss: 'span.employee-name',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
