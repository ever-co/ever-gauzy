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
	projectOrContactsDropdownCss: '#departmentsSelect, #assignProjectsSearch, #assignContactsSearch',
	projectOrContactDropdownOptionCss: 'div.ng-option',
	// Projects tab = <ga-edit-employee-projects> and Contacts tab = <ga-edit-employee-contacts> (#11660, #11669),
	// tables of their own: the header's "Assign projects" / "Assign contacts" opens the assign dialog (in the
	// overlay, outside the tab) — a search (#assignProjectsSearch / #assignContactsSearch) over a checklist of
	// `button.assign-option` rows; its "Assign" persists the ticks; rows are `ul.projects__list > li.projects__row`
	// and `ul.contacts__list > li.contacts__row`. The older <ga-edit-employee-membership> (header "+ Add", its own
	// "Add", rows `ul.membership__list > li.membership__row`) is still named for any page that keeps it.
	// Only one tab is on the page at a time, so each selector names every one of them.
	assignOptionCss: '.assign-dialog button.assign-option',
	projectAssignOptionCss: '.assign-dialog button.assign-option',
	assignedRowNameCss: '.project-name, .contact-name',
	addProjectOrContactButtonCss:
		'ga-edit-employee-membership header.membership__header > button[status="success"], ga-edit-employee-projects button.projects__assign-toggle, ga-edit-employee-contacts button.contacts__assign-toggle',
	saveProjectOrContactButtonCss:
		'ga-edit-employee-membership .membership__add-actions > button[status="success"], .assign-dialog button.assign-dialog__submit',
	verifyProjectOrContactCss:
		'ga-edit-employee-membership ul.membership__list > li.membership__row, ga-edit-employee-projects ul.projects__list > li.projects__row, ga-edit-employee-contacts ul.contacts__list > li.contacts__row',
	// Account tab's Save (17125da2e8, #10115 moved it from `div.actions` into `footer.account__actions`).
	saveButtonCss: 'ga-edit-employee-main footer.account__actions > button[status="success"]',
	verifyEmployeeCss: 'span.employee-name',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
