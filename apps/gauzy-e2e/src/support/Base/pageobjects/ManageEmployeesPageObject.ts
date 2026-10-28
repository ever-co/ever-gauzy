export const ManageEmployeesPage = {
	gridButtonCss: 'div.layout-switch > button',
	inviteButtonCss: 'button.action[status="info"]',
	emailsInputCss: '#emails',
	// Invite dialog's "Date when started work" (the invite dialog is the only thing open at that point).
	dateInputCss: '[formcontrolname="startedWorkOn"]',
	// Add-Employee dialog's own start-work date. It has NO id, so the bare
	// `[formcontrolname="startedWorkOn"]` matches this AND the invite dialog's field whenever the
	// invite dialog is still mounted (e.g. its Send failed), and clearField()/enterInput() — which have
	// no .first() — die on a Playwright strict-mode violation instead of reporting the real problem.
	employeeDateInputCss: 'ga-employee-mutation [formcontrolname="startedWorkOn"]',
	selectProjectDropdownCss: '#projectSelection',
	selectProjectDropdownOptionCss: 'div.ng-option > span.ng-option-label',
	// Invite dialog Send ("Send Invitation"): the redesigned invite dialog (#10761, 699b3c7187) moved its actions
	// into `nb-card-footer.invite-footer .actions` — ghost Cancel + primary send, [disabled] until the form has
	// an email. The old success-status footer button no longer exists.
	sendInviteButtonCss: 'ga-invite-mutation nb-card-footer.invite-footer .actions > button[status="primary"]',
	addEmployeeButtonCss: 'button[status="success"]:has-text("Add")',
	editEmployeeButtonCss: 'button.action.primary',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Full Name column filter input in the smart-table header (tr.angular2-smart-filters). Typing the
	// created employee's name filters the grid down to just that record so row 0 is the one we created,
	// not a seeded employee (the fresh seed renders Super Admin + Default Employee ahead of it).
	nameFilterInputCss: 'th.angular2-smart-th.fullName input',
	deleteEmployeeButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	// Scoped to the employee delete-confirmation dialog so no other card footer on the page can match first.
	confirmDeleteButtonCss: 'ga-delete-confirmation nb-card-footer > button[status="danger"]',
	endWorkButtonCss: 'button.action.orange',
	endWorkDateInputCss: '[placeholder="Pick a Date"]',
	confirmEndWorkButtonCss: 'ga-employee-end-work nb-card-footer > button[status="success"]',
	firstNameInputCss: '#firstName',
	lastNameInputCss: '#lastName',
	usernameInputCss: '#username',
	emailInputCss: '#email',
	// ngx-password-form-field reflects id onto BOTH its host element and the inner input; scope to
	// input# so enterInput's fill() (no .first()) doesn't hit a strict-mode violation.
	passwordInputCss: 'input#password',
	// MUST stay scoped to the Add-Employee dialog. The employees grid's Tags column filter is a
	// TagsColorFilterComponent -> <ga-tags-color-input> -> <ng-select id="addTags">, i.e. a SECOND
	// #addTags that sits EARLIER in the DOM than the dialog's (the dialog lives in the cdk-overlay
	// container appended at the end of <body>), so a bare '#addTags' + .first() drove the GRID filter
	// while the dialog was open. That is not merely "the tag went to the wrong control": when no tag
	// exists yet in the org (edit-employee is the first spec in its shard and seeds its tag only AFTER
	// this call), the option list stays empty and the ng-select driver falls into its re-open branch,
	// `.ng-select-container.click({ force: true })`. force only skips the actionability CHECK — the
	// click is still delivered at screen coordinates, which for a control BEHIND the modal means the
	// dialog's cdk-overlay-backdrop; NbDialogService.open(EmployeeMutationComponent) takes the default
	// closeOnBackdropClick: true, so the whole Add Employee form was dismissed mid-fill. The visible
	// symptom was several steps later ("#inputImageUrl input[type=text]" not found), because the
	// clickCardBody() in between is wrapped in .catch(). Same fix already applied to the candidates,
	// payments, departments, income and teams page objects for this exact clash.
	addTagsDropdownCss: 'ga-employee-mutation #addTags',
	tagsDropdownOption: 'div.ng-option',
	// The picture of the Add-Employee form. The shared basic-info form
	// (packages/ui-core/shared/src/lib/user/forms/basic-info/basic-info-form.component.html) no longer has
	// the `#inputImageUrl` image-URL text input: #10336 (a73de1d121) replaced it with an
	// `<ngx-image-uploader>` avatar whose transparent `input[type=file]` uploads the picture to
	// /api/image-assets/upload/<folder>. This is the scope handed to util.uploadImageThroughUploader.
	employeeImageUploaderScopeCss: 'ga-employee-mutation ga-user-basic-info-form',
	// A non-interactive spot INSIDE the Add-Employee dialog (its header title). Clicking it is an
	// "outside click" for the body-appended tags ng-select panel (closeOnSelect=false keeps it open after
	// a pick) without any risk of hitting a form control or the nb-dialog backdrop.
	employeeDialogTitleCss: 'ga-employee-mutation nb-card-header h5.title',
	// The redesigned Add-Employee dialog (#10336, a73de1d121): the nb-stepper's own header is replaced by
	// a step bar in the card header (`nav.steps > div.step`, the active one carries aria-current="step"),
	// and the per-step nbStepperNext buttons are gone — EVERY action now sits in
	// `nb-card-footer.dialog-footer`, switched on the stepper index:
	//   step 0: [Discard entry] · Cancel · primary "Continue" (arrow-forward icon, disabled while the
	//           basic-info form is invalid)
	//   step 1: Back · outline "Add Another Employee" (addEmployee(): queue + reset, never persists) ·
	//           primary "Continue" (arrow-forward icon)
	//   step 2: Back · primary "Create employees (n)" (checkmark icon) -> add() -> createBulk()
	// The primary button with the arrow-forward icon is therefore the current step's Continue, and the
	// primary button with the checkmark icon is ONLY ever the step-2 Create — "Add Another Employee" is
	// status="basic", so it can never be hit by either selector.
	employeeStepIndicatorCss: 'ga-employee-mutation nb-card-header nav.steps > div.step',
	nextButtonCss:
		'ga-employee-mutation nb-card-footer.dialog-footer button[status="primary"]:has(nb-icon[icon="arrow-forward-outline"])',
	nextStepButtonCss:
		'ga-employee-mutation nb-card-footer.dialog-footer button[status="primary"]:has(nb-icon[icon="arrow-forward-outline"])',
	lastStepButtonCss:
		'ga-employee-mutation nb-card-footer.dialog-footer button[status="primary"]:has(nb-icon[icon="checkmark-outline"])',
	// Account tab Save of the employee edit page: the account form was redesigned (17125da2e8, #10115) and
	// its Save now sits in `footer.account__actions` (no `div.actions` wrapper any more).
	saveEditButtonCss: 'ga-edit-employee-main footer.account__actions > button[status="success"]',
	// The edit page header's <ngx-back-navigation> (location.back()). Scoped to the component so another
	// `div.main` on the page can't match first.
	backButtonCss: 'ngx-back-navigation div.main > button[status="primary"]',
	usernameEditInputCss: '#username',
	emailEditInputCss: '#email',
	firstNameEditInputCss: '#firstName',
	lastNameEditInputCss: '#lastName',
	usernameEditSecondInputCss: '#usernameInput',
	emailEditSecondInputCss: '#emailInput',
	firstNameSecondEditInputCss: '#firstNameInput',
	lastNameSecondEditInputCss: '#lastNameInput',
	// Account tab "Preferred Language": the redesigned account form (17125da2e8) dropped the `div.col-sm-6`
	// grid wrapper, so anchor on the account component itself.
	preferredLanguageDropdownCss: 'ga-edit-employee-main ngx-language-selector > ng-select',
	preferredLanguageOptionCss: 'ng-dropdown-panel.ng-dropdown-panel > div.ng-dropdown-panel-items div.ng-option',
	// Header "Manage Invites": since #10113 (a001ed4d07) it is a direct child of the `.card-header-title` row
	// (the `div.mr-2` wrapper is gone) and carries `.action` like the other header buttons.
	manageInvitesButtonCss: 'nb-card-header div.card-header-title > button.action[status="primary"]',
	// Email-column filter input in the invites smart-table header. The invites grid accumulates invites
	// from earlier specs (shared serial DB), so a blind row-0 pick can grab another spec's invite (whose
	// status may not be INVITED -> Copy/Resend buttons wouldn't render). Filter by THIS spec's invited
	// email so the spec's own invite is the only/first data row.
	inviteEmailFilterInputCss: 'th.angular2-smart-th.email input',
	copyLinkButtonCss: 'button.action.success',
	resendInviteButtonCss: 'button.action.warning',
	deleteInviteButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmResendInviteButtonCss: 'ga-resend-confirmation nb-card-footer > button[status="success"]',
	// The invite delete confirmation (#10761, 699b3c7187) is now type-to-confirm: its danger button stays
	// [disabled] until the invitee's email is typed into #invite-delete-email.
	confirmDeleteInviteButtonCss: 'ga-invite-delete-confirmation nb-card-footer > button[status="danger"]',
	deleteInviteConfirmInputCss: 'ga-invite-delete-confirmation input#invite-delete-email',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyEmployeeCss: 'angular2-smart-table',
	verifyInviteCss: 'angular2-smart-table'
};
