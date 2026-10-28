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
	// Forward button of every contact-wizard step ("Next" on 1-3, "Save" on 4). #10308 (e9e6bfd9fa) made the
	// step-4 Save `outline status="basic" class="green"` like the others (it was `status="success"`), so
	// the old `button.green, button[status="success"]` union is just `.green` — scoped to the wizard.
	lastStepBtnCss: 'ga-contact-mutation .wizard-actions button.green',
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
	// ng-select copies the host's static class (`projects-select`) onto its body-appended panel.
	projectsDropdownOptionCss: 'ng-dropdown-panel.projects-select div.ng-option',
	// Members step: #10308 (e9e6bfd9fa) replaced `ga-employee-multi-select` (nb-select, `.option-list
	// nb-option`) with a searchable multi `ng-select.members-select` (appendTo="body").
	usersMultiSelectCss: 'ga-contact-mutation ng-select.members-select',
	membersOptionCss: 'ng-dropdown-panel.members-select div.ng-option',
	dropdownOptionCss: '.option-list nb-option',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	websiteInputCss: '[formcontrolname="website"]',
	// Neutral outside-click target (closes an open ng-select panel): the wizard's title. `div.contact-container`
	// is gone — #10308 made it `<aside class="contact-container">` around the ngx-image-uploader, whose
	// centre is a transparent <input type="file">.
	cardBodyCss: 'ga-contact-mutation nb-card-header h4',
	saveButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	nextButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	// Host of the add/edit wizard: removed from the page once the contact is saved.
	contactMutationCss: 'ga-contact-mutation',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	clientNameCss: '[formcontrolname="name"]',
	clientPhoneCss: '[formcontrolname="primaryPhone"]',
	clientEmailCss: '#emailInput',
	toastrMessageCss: 'nb-toast.ng-trigger',
	saveInviteButtonCss: 'nb-card-footer > button[status="success"]',
	// Host of the Invite Contact dialog (ga-invite-contact). Used to detect whether the invite dialog is
	// still open after clicking Email Invite — the button's async email-exists validator (getUserByEmail)
	// is PENDING for a beat after the email is typed, so an early click finds form.valid === false and
	// inviteContact() no-ops (dialog stays open). We poll this to re-dispatch until it actually closes.
	inviteDialogCss: 'ga-invite-contact',
	verifyClientCss: 'a.link-text',
	searchNameInputCss: 'ga-input-filter-selector input[placeholder="Name"]',
	clientsTableData: 'td.ng-star-inserted',
	clientsTableRow: 'tr[class="angular2-smart-row ng-star-inserted"]',
	viewButtonCss: 'div.btn-group.actions button.action.secondary',
	// The contact view puts the name and the contact type on the card header line
	// (they used to sit in a pill halfway down the left column).
	clientNameViewCss: 'h4.identity-name',
	clientTypeViewCss: 'span.identity-type',
	backBtn: 'ngx-back-navigation > div > button[status="primary"]'
};
