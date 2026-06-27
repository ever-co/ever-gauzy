export const ContactsLeadsPage = {
	gridButtonCss: 'div.layout-switch > button',
	addButtonCss: 'button[status="success"]:has(nb-icon[icon="plus-outline"])',
	editButtonCss: 'div.btn-group.actions button.action.primary',
	// Toolbar "Invite" (class="action info", status=basic) — it calls contacts.component.invite()
	// which opens the InviteContactComponent dialog directly. The per-row ngx-contact-action Invite
	// (status=success) only emits updateResult, which has NO subscriber on the contacts/leads page,
	// so clicking it opens nothing (verified live). Target the toolbar button.
	inviteButtonCss: 'button.action.info',
	deleteButtonCss: 'div.btn-group.actions button:has(nb-icon.status-danger)',
	// Scope the add/edit stepper fields to nb-stepper: the InviteContactComponent dialog leaves a
	// lingering cdk-overlay in the DOM after it closes, which ALSO has formcontrolname="name"/"primaryPhone"
	// — without the scope these match 2 elements and clear()/fill() hit a strict-mode violation.
	nameInputCss: 'nb-stepper [formcontrolname="name"]',
	emailInputCss: '#email',
	phoneInputCss: 'nb-stepper [formcontrolname="primaryPhone"]',
	lastStepBtnCss: 'button.green, button[status="success"]',
	countryDropdownCss: 'ga-country ng-select',
	// country is an <ng-select> (options render as div.ng-option in an appended panel), NOT the
	// nb-select used elsewhere — its option selector differs from dropdownOptionCss (nb-option).
	countryDropdownOptionCss: 'div.ng-option',
	cityInputCss: '[formcontrolname="city"]',
	budgetInputCss: 'input[formcontrolname="budget"]',
	postCodeInputCss: '[formcontrolname="postcode"]',
	streetInputCss: '[formcontrolname="address"]',
	projectsDropdownCss: '[formcontrolname="projects"]',
	projectsDropdownOptionCss: 'div.ng-option',
	usersMultiSelectCss: 'div.form-group ga-employee-multi-select nb-select',
	dropdownOptionCss: '.option-list nb-option',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	websiteInputCss: '[formcontrolname="website"]',
	cardBodyCss: 'div.contact-container',
	saveButtonCss: 'button.green, button[status="success"]',
	nextButtonCss: 'button.green, button[status="success"]',
	finishButtonCss: 'button.green, button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	contactNameCss: '[formcontrolname="name"]',
	contactPhoneCss: '[formcontrolname="primaryPhone"]',
	contactEmailCss: '#emailInput',
	toastrMessageCss: 'nb-toast.ng-trigger',
	saveInviteButtonCss: 'nb-card-footer > button[status="success"]',
	verifyLeadCss: 'a.link-text',
	searchNameInputCss: 'ga-input-filter-selector input[placeholder="Name"]',
	clientsTableData: 'td.ng-star-inserted',
	clientsTableRow: 'tr[class="angular2-smart-row ng-star-inserted"]'
};
