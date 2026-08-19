export const CandidatesPage = {
	gridButtonCss: 'div.layout-switch > button',
	// The always-visible toolbar slot. #9975 rebuilt ngx-gauzy-button-action: the old wrapper was
	// <span class="transition" [class.show-button]="isDisable()"> — a class applied only while the
	// selection strip was CLOSED, which is this page's resting state, so it happened to match. That
	// span is now <span class="visible-slot"> and carries the same projected Invite/Add buttons.
	inviteButtonCss: 'ngx-gauzy-button-action span.visible-slot button[status="primary"]',
	emailInputCss: '#emails',
	dateInputCss: '[placeholder="Date"]',
	sendInviteButtonCss: 'nb-card-footer button[status="success"]',
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
	imageInputCss: 'ga-candidate-mutation #inputImageUrl input[placeholder="Image"]',
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
	saveEditButtonCss: 'div.actions > button[status="success"]',
	backButtonCss: 'ngx-back-navigation button[status="primary"]',
	confirmActionButtonCss: 'nb-card-footer > button[status="danger"]',
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
