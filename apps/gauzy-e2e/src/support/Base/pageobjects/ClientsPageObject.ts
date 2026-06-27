export const ClientsPage = {
	gridButtonCss: 'div.layout-switch > button',
	addButtonCss: 'button[status="success"]:has(nb-icon[icon="plus-outline"])',
	editButtonCss: 'div.btn-group.actions button.action.primary',
	// Toolbar Invite (calls invite() → opens the dialog). The per-row ngx-contact-action Invite only
	// emits updateResult, which has no subscriber on the contacts page, so it opens nothing.
	inviteButtonCss: 'button.action.info',
	deleteButtonCss: 'div.btn-group.actions button:has(nb-icon.status-danger)',
	// Scope add/edit stepper fields to nb-stepper: the closed invite dialog lingers in a cdk-overlay with
	// the same formcontrolnames, so unscoped these match 2 elements → strict-mode on clear()/fill().
	nameInputCss: 'nb-stepper [formcontrolname="name"]',
	emailInputCss: '#email',
	lastStepBtnCss: 'button.green, button[status="success"]',
	phoneInputCss: 'nb-stepper [formcontrolname="primaryPhone"]',
	budgetInputCss: 'input[formcontrolname="budget"]',
	countryDropdownCss: 'ga-country ng-select',
	// country is an <ng-select> (options render as div.ng-option in an appended panel), NOT the
	// nb-select used elsewhere — its option selector differs from dropdownOptionCss (nb-option).
	countryDropdownOptionCss: 'div.ng-option',
	cityInputCss: '[formcontrolname="city"]',
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
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	clientNameCss: '[formcontrolname="name"]',
	clientPhoneCss: '[formcontrolname="primaryPhone"]',
	clientEmailCss: '#emailInput',
	toastrMessageCss: 'nb-toast.ng-trigger',
	saveInviteButtonCss: 'nb-card-footer > button[status="success"]',
	verifyClientCss: 'a.link-text',
	searchNameInputCss: 'ga-input-filter-selector input[placeholder="Name"]',
	clientsTableData: 'td.ng-star-inserted',
	clientsTableRow: 'tr[class="angular2-smart-row ng-star-inserted"]',
	viewButtonCss: 'div.btn-group.actions button.action.secondary',
	clientNameViewCss: 'div.profile-user-title-name',
	clientTypeViewCss: 'div.profile-user-title-type',
	backBtn: 'ngx-back-navigation > div > button[status="primary"]'
};
