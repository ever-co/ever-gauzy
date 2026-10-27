export const CandidatesPage = {
	gridButtonCss: 'div.layout-switch > button',
	// The always-visible toolbar slot. #9975 rebuilt ngx-gauzy-button-action: the old wrapper was
	// <span class="transition" [class.show-button]="isDisable()"> — a class applied only while the
	// selection strip was CLOSED, which is this page's resting state, so it happened to match. That
	// span is now <span class="visible-slot"> and carries the same projected Invite/Add buttons.
	inviteButtonCss: 'ngx-gauzy-button-action span.visible-slot button[status="primary"]',
	// The shared invite dialog (ga-invite-mutation > ga-email-invite-form). Scoped to the dialog host so
	// the add-candidate dialog's own #appliedDate can never be matched instead.
	emailInputCss: 'ga-invite-mutation #emails',
	dateInputCss: 'ga-invite-mutation #appliedDate',
	// The invite dialog was redesigned: its footer is now `nb-card-footer.invite-footer` with a ghost
	// Cancel and a PRIMARY send button ("Invite Candidates", paper-plane icon) inside `.actions`, which is
	// [disabled] while the email form is invalid. There is no status="success" button any more.
	// (packages/ui-core/shared/src/lib/invite/invite-mutation/invite-mutation.component.html)
	sendInviteButtonCss: 'ga-invite-mutation nb-card-footer.invite-footer .actions button[status="primary"]',
	inviteDialogCancelButtonCss: 'ga-invite-mutation nb-card-footer.invite-footer .actions button[status="basic"]',
	inviteDialogCloseButtonCss: 'ga-invite-mutation nb-card-header button.close-button',
	addButtonCss: 'ngx-gauzy-button-action span.visible-slot button[status="success"]',
	// The invite step posts to /api/invite/emails; on a server-side rejection (400) the
	// invite-mutation dialog's add() catch does NOT closeDialog(), so ga-email-invite-form stays
	// mounted while the add-candidate dialog opens. Both forms share id="appliedDate" (and the
	// invite footer button is also status="success"), so unscoped selectors hit two elements
	// (strict-mode violation) or the wrong dialog. Scope every add-candidate (ga-candidate-mutation)
	// field/button to that host so the leaked invite dialog can never be matched.
	// Clicking the mutation card body closes the appendTo="body" tags ng-select panel (which has
	// [closeOnSelect]="false") so it can't overlay the stepper footer — mirrors the green employee flow.
	cardBodyCss: 'ga-candidate-mutation nb-card-body',
	firstNameInputCss: 'ga-candidate-mutation #firstName',
	lastNameInputCss: 'ga-candidate-mutation #lastName',
	usernameInputCss: 'ga-candidate-mutation #username',
	newCandidateEmailInputCss: 'ga-candidate-mutation #email',
	passwordInputCss: 'ga-candidate-mutation input#password',
	// The basic-info form's image-URL text input (#inputImageUrl, placeholder "Image") was replaced by
	// an avatar uploader in a73de1d121 (#10336): a transparent <ngx-image-uploader> file input laid over
	// the `.photo .avatar` circle. imageUploaderCss is the visible avatar control; imageInputCss is the
	// file input inside it (setInputFiles target, see util.uploadImageThroughUploader).
	imageUploaderCss: 'ga-candidate-mutation ga-user-basic-info-form div.photo div.avatar',
	imageInputCss: 'ga-candidate-mutation ga-user-basic-info-form ngx-image-uploader input[type="file"]',
	newCandidateDateInputCss: 'ga-candidate-mutation #appliedDate',
	addTagsDropdownCss: 'ga-candidate-mutation #addTags',
	tagsDropdownOption: 'div.ng-option',
	nextButtonCss: 'ga-candidate-mutation button.green',
	nextStepButtonCss: 'ga-candidate-mutation button.green',
	allCurrentCandidatesButtonCss: 'ga-candidate-mutation button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	editButtonCss: 'div.btn-group.actions button.action.primary',
	archiveButtonCss: 'div.btn-group.actions button.action.secondary',
	rejectButtonCss: 'div.btn-group.actions button.action.warning',
	// Edit page "account" tab (ga-edit-candidate-main) Save, scoped to that tab's form.
	saveEditButtonCss: 'ga-edit-candidate-main div.actions > button[status="success"]',
	backButtonCss: 'ngx-back-navigation button[status="primary"]',
	// OK of the reject (ga-candidate-action-confirmation) and archive (ga-archive-confirmation) dialogs —
	// both still render it as a direct status="danger" child of nb-card-footer; scoped to the two hosts.
	confirmActionButtonCss:
		'ga-candidate-action-confirmation nb-card-footer > button[status="danger"], ga-archive-confirmation nb-card-footer > button[status="danger"]',
	// Full-name column filter of the candidates grid (InputFilterComponent -> server-side user.name filter).
	nameFilterInputCss: 'th.angular2-smart-th.fullName input',
	checkboxButtonCss: 'nb-toggle.custom-toggle',
	manageAddButtonCss: 'div.header > button[status="success"]',
	locationButtonCss: '[router-link="/pages/employees/candidates/ed"]',
	countryDropdownCss: 'ga-country ng-select',
	selectDropdownOptionCss: '.option-list nb-option',
	cityInputCss: '#cityInput',
	addressOneInputCss: '#addressInput',
	postCodeInputCss: '#postcodeInput',
	saveActionButtonCss: 'ga-edit-candidate-main div.actions > button[status="success"]',
	ratesButtonCss: '.route-tab:nth-child(5) > .tab-text',
	payPeriodDropdownCss: '#payPeriodsSelect',
	billRateInputCss: '#billRateValueInput',
	experienceButtonCss: '.route-tab:nth-child(7) > .tab-text',
	addExperienceButtonCss: 'div.btn > button[status="success"]',
	schoolNameInputCss: '[formcontrolname="schoolName"]',
	degreeInputCss: '[formcontrolname="degree"]',
	saveExperienceButtonCss: 'div.col-2 > button[status="success"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyCandidateCss: 'a.link-text',
	badgeCss: 'div.badge-danger'
};
