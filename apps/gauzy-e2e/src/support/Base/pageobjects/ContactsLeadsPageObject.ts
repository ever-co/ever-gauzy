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
	// The contact-mutation stepper's forward button on EVERY step is the `.wizard-actions` `button.green`
	// ("Next" on steps 1-3, "Save" on step 4). Step 4's Save used to be `status="success"`; #10308
	// (e9e6bfd9fa) restyled it as `outline status="basic" class="green"` like the other steps, so the old
	// `button.green, button[status="success"]` union is now just `.green` — scoped to the stepper so nothing
	// else on the page can match first.
	lastStepBtnCss: 'ga-contact-mutation .wizard-actions button.green',
	countryDropdownCss: 'ga-country ng-select',
	// country is an <ng-select> (options render as div.ng-option in an appended panel), NOT the
	// nb-select used elsewhere — its option selector differs from dropdownOptionCss (nb-option).
	countryDropdownOptionCss: 'div.ng-option',
	cityInputCss: '[formcontrolname="city"]',
	budgetInputCss: 'input[formcontrolname="budget"]',
	postCodeInputCss: '[formcontrolname="postcode"]',
	streetInputCss: '[formcontrolname="address"]',
	projectsDropdownCss: '[formcontrolname="projects"]',
	// The Projects ng-select carries the static class `projects-select`, which ng-select copies onto its
	// body-appended panel: scoping to it keeps another open panel (tags) from answering for it.
	projectsDropdownOptionCss: 'ng-dropdown-panel.projects-select div.ng-option',
	// Step 4 (Members): #10308 (e9e6bfd9fa) replaced `ga-employee-multi-select` (an nb-select whose options
	// were `.option-list nb-option`) with a searchable multi `ng-select.members-select`, appendTo="body".
	// ng-select copies the host's static class onto its body-appended panel, so the options are scoped by
	// `ng-dropdown-panel.members-select`.
	usersMultiSelectCss: 'ga-contact-mutation ng-select.members-select',
	membersOptionCss: 'ng-dropdown-panel.members-select div.ng-option',
	dropdownOptionCss: '.option-list nb-option',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	websiteInputCss: '[formcontrolname="website"]',
	// Neutral click target that closes an open ng-select panel (outside mousedown) without side effects:
	// the wizard's title. `div.contact-container` is gone — #10308 made it `<aside class="contact-container">`
	// and filled it with the ngx-image-uploader, whose centre is a transparent <input type="file">.
	cardBodyCss: 'ga-contact-mutation nb-card-header h4',
	saveButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	nextButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	finishButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	// Host of the add/edit wizard: it is removed from the page once the contact is saved.
	contactMutationCss: 'ga-contact-mutation',
	// Host of the Invite Contact dialog — detaches once the invite is persisted.
	inviteDialogCss: 'ga-invite-contact',
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
