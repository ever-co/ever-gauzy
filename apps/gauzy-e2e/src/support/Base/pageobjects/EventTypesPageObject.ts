export const EventTypesPage = {
	gridButtonCss: 'div.layout-switch > button',
	addEventTypeButtonCss: 'div.actions-container button[status="success"]',
	editEventTypeButtonCss: 'div.actions-container button.action.primary',
	deleteEventTypeButtonCss:
		'div.actions-container button.action:not(.primary):not([status="success"])',
	// Target the inner nb-select (not the wrapper host): Nebular's select opens on a click of the
	// nb-select control itself, so clicking the ga-employee-multi-select host can no-op. Mirrors the
	// verified-green ContactsLeads usersMultiSelectCss.
	selectEmployeeDropdownCss: 'ga-employee-multi-select nb-select',
	// The opened nb-select renders its options as `.option-list nb-option` in a cdk overlay; the
	// stricter `nb-option-list > ul.option-list > nb-option` chain can miss the actual DOM. Mirrors
	// the verified-green ContactsLeads dropdownOptionCss.
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	titleInputCss: '#title',
	descriptionInputCss: '#description',
	durationInputCss: '#durationInput',
	activeCheckboxCss: '[formcontrolname="isActive"]',
	saveButtonCss: 'nb-card-footer > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	confirmDeleteEventTypeButtonCss: 'nb-card-footer > button[status="danger"]',
	verifyEventTypeCss: 'ga-notes-with-tags > div > div.ng-star-inserted',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
