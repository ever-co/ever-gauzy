export const ProposalsPage = {
	gridButtonCss: 'div.layout-switch > button',
	registerProposalButtonCss: '.gauzy-button-container button[status="success"]',
	selectEmployeeDropdownCss: 'ga-employee-selector.employees',
	selectEmployeeDropdownOptionCss: 'div.ng-option',
	// Contact ng-select on the register form (formcontrolname="organizationContact"); registerProposal()
	// dereferences organizationContact.id, so a contact MUST be set or the create silently no-ops.
	contactDropdownCss: 'ga-contact-select',
	contactDropdownOptionCss: 'div.ng-option',
	jobPostUrlInputCss: '[formcontrolname="jobPostUrl"]',
	dateInputCss: '[formcontrolname="valueDate"]',
	jobPostContentInputCss: '[formControlName="jobPostContent"]',
	proposalContentInputCss: '[formControlName="proposalContent"]',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	saveProposalButtonCss: 'nb-card-footer > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// #9975 removed the toolbar's duplicate "Details" button: the View button — previously an
	// `underConstruction` placeholder — took over `(click)="details(selectedItem)"` and is now the only
	// way into the proposal details page. It is `class="action secondary"` and sits under
	// ngxPermissionsOnly="ORG_PROPOSALS_VIEW" rather than in the EDIT block. The old
	// `button.action.primary:has-text("Details")` matches ZERO elements — absent, not hidden. Keeping
	// the historical key name so the page-object/step names stay stable.
	// No text match: `action secondary` occurs exactly ONCE in proposal.component.html (the View
	// button), so the class pair alone identifies it and the selector cannot be broken by a language
	// change — unlike a `:has-text("View")` qualifier, which this suite's language-switching scenarios
	// would invalidate.
	detailsButtonCss: '.gauzy-button-container button.action.secondary',
	// On the proposal DETAILS page the Edit button lives in nb-card-header (NOT .gauzy-button-container),
	// so the old .gauzy-button-container-scoped selector never matched there.
	editProposalButtonCss: 'button.action.primary:has-text("Edit")',
	markAsStatusButtonCss: '.gauzy-button-container button.action.warning',
	deleteProposalButtonCss: '.gauzy-button-container button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	confirmStatusButtonCss: 'nb-card-footer > button[status="success"]',
	cardBodyCss: 'nb-card-footer.text-left',
	backButtonCss: 'div.main > button[status="primary"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyProposalCss: 'angular2-smart-table',
	acceptedProposalCss: 'div.badge-success',
	manageTemplatesBtnCss: 'button.action[status="info"]:has-text("Templates")',
	addProposalTemplateBtnCss: '.gauzy-button-container button[status="success"]',
	editProposalTemplateBtnCss: '.gauzy-button-container button.action.primary:has-text("Edit")',
	deleteProposalTemplateBtnCss: '.gauzy-button-container button.action:has(nb-icon[icon="trash-2-outline"])',
	templateNameInputCss: 'div.form-group > input[formcontrolname="name"]',
	saveTemplateBtnCss: 'nb-card-footer.text-left > button[status="success"]',
	confirmDeleteTemplateBtnCss: 'nb-card-footer > button[status="primary"]',
	rejectDeleteBtnCss: 'nb-card-footer > button[status="basic"]',
	verifyProposalTemplateCss: 'div.ng-star-inserted',
	employeeMultiSelectCss: 'ga-employee-multi-select button.select-button',
	employeeMultiSelectDropdownOptionCss: '.option-list nb-option',
	headerTitleCss: 'ngx-header-title'
};
