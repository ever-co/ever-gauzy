export const CustomersPage = {
	gridButtonCss: 'div.layout-switch > button',
	addButtonCss: 'button[status="success"]:has(nb-icon[icon="plus-outline"])',
	editButtonCss: 'button:has(nb-icon[icon="edit-outline"])',
	inviteButtonCss: 'button.action.info',
	deleteButtonCss: 'button:has(nb-icon[icon="trash-2-outline"])',
	// Scope the add/edit stepper Name + Phone to nb-stepper: the invite step opens an NbDialog that,
	// once closed, lingers in a fading cdk-overlay carrying the SAME formcontrolnames. Unscoped, these
	// match 2 elements during the later edit step, so clearField()/enterInput() (which don't use
	// .first()) throw a Playwright strict-mode violation. Mirrors the verified-green ClientsPageObject.
	nameInputCss: 'nb-stepper [formcontrolname="name"]',
	emailInputCss: '#email',
	budgetInputCss: 'input[formcontrolname="budget"]',
	// Forward button of every contact-wizard step ("Next" on 1-3, "Save" on 4). The step-4 Save is no
	// longer `status="success"`: #10308 (e9e6bfd9fa) restyled it `outline status="basic" class="green"`.
	lastStepBtnCss: 'ga-contact-mutation .wizard-actions button.green',
	phoneInputCss: 'nb-stepper [formcontrolname="primaryPhone"]',
	countryDropdownCss: 'ga-country ng-select',
	cityInputCss: '[formcontrolname="city"]',
	postCodeInputCss: '[formcontrolname="postcode"]',
	streetInputCss: '[formcontrolname="address"]',
	projectsDropdownCss: '[formcontrolname="projects"]',
	projectsDropdownOptionCss: 'div.ng-option',
	// Members step: #10308 (e9e6bfd9fa) replaced `ga-employee-multi-select` (nb-select) with a searchable
	// multi `ng-select.members-select` (appendTo="body"; the panel carries the host class).
	usersMultiSelectCss: 'ga-contact-mutation ng-select.members-select',
	membersOptionCss: 'ng-dropdown-panel.members-select div.ng-option',
	dropdownOptionCss: '.option-list nb-option, .ng-option',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	websiteInputCss: '[formcontrolname="website"]',
	// The wizard's title — `div.contact-container` is gone (#10308 made it an <aside> around the image
	// uploader).
	cardBodyCss: 'ga-contact-mutation nb-card-header h4',
	saveButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	nextButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	finishButtonCss: 'ga-contact-mutation .wizard-actions button.green',
	// Host of the add/edit wizard: removed from the page once the contact is saved.
	contactMutationCss: 'ga-contact-mutation',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	customerNameCss: '[formcontrolname="name"]',
	customerPhoneCss: '[formcontrolname="primaryPhone"]',
	customerEmailCss: '#emailInput',
	toastrMessageCss: 'nb-toast.ng-trigger',
	saveInviteButtonCss: 'nb-card-footer > button[status="success"]',
	verifyCustomerCss: 'a.link-text'
};
