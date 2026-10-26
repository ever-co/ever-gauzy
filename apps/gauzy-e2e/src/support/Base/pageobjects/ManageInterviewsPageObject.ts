// The "Schedule Interview" dialog (ga-candidate-interview-mutation) was redesigned in #10359 (75957d91aa):
// the step header is a custom `nav.steps` indicator and the step buttons moved OUT of the nb-stepper into
// `nb-card-footer.dialog-footer`, rendered per step with an @switch: step 1 = primary Next
// (arrow-forward-outline); step 2 = ghost Previous, ghost Create criterions, primary Next
// (arrow-forward-outline); step 3 = ghost Previous, primary Save (checkmark-outline). The old `button.green`
// stepper buttons, the `button.mr-3.ml-3[status="success"]` Save and `nb-card-body.stepper` are gone.
// (packages/ui-core/shared/src/lib/candidate/candidate-interview-mutation/*.html)
// Everything is scoped to the dialog host so the calendar page behind it (which has its own
// ga-employee-multi-select / ga-candidate-multi-select) can never match first.
export const ManageInterviewsPage = {
	addInterviewButtonCss: 'ga-manage-candidate-interviews div.add-btn > button[status="primary"]',
	interviewDialogCss: 'ga-candidate-interview-mutation',
	candidateDropdownCss: 'ga-candidate-interview-mutation ga-candidate-select input[placeholder="Add candidate"]',
	candidateDropdownOptionCss: '.option-list nb-option',
	titleInputCss: 'ga-candidate-interview-mutation #inputTitle',
	dateInputCss: 'ga-candidate-interview-mutation ngx-timer-range-picker input[name="date"]',
	employeeMultiselectCss: 'ga-candidate-interview-form ga-employee-multi-select nb-select',
	employeeMultiselectDropdownOptionCss: 'nb-option-list > ul.option-list > nb-option',
	radioButtonCss: 'ga-candidate-interview-form nb-radio-group nb-radio > label > span.inner-circle',
	locationInputCss: 'ga-candidate-interview-form #location',
	noteInputCss: 'ga-candidate-interview-form #note',
	nextButtonCss:
		'ga-candidate-interview-mutation nb-card-footer.dialog-footer button[status="primary"]:has(nb-icon[icon="arrow-forward-outline"])',
	nextStepButtonCss:
		'ga-candidate-interview-mutation nb-card-footer.dialog-footer button[status="primary"]:has(nb-icon[icon="arrow-forward-outline"])',
	// Step content rendered only while that step is selected (nb-stepper projects the selected step only).
	criterionsStepCss: 'ga-candidate-interview-mutation ga-candidate-criterions-form',
	notificationStepCss: 'ga-candidate-interview-mutation ga-candidate-notification-form',
	notifyCandidateCss: 'ga-candidate-notification-form div.notify-options nb-checkbox > label > span.custom-checkbox',
	saveButtonCss:
		'ga-candidate-interview-mutation nb-card-footer.dialog-footer button[status="primary"]:has(nb-icon[icon="checkmark-outline"])',
	// Interviews panel tab (ga-interview-panel): its smart table and the Candidate (fullName) column filter.
	interviewPanelCss: 'ga-interview-panel',
	interviewPanelNameFilterCss: 'ga-interview-panel th.angular2-smart-th.fullName input',
	verifyCandidateCss: 'ga-interview-panel angular2-smart-table',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// The dialog body is the scroll container now (nb-card-body.dialog-body, overflow-y: auto).
	scrollElementCss: 'ga-candidate-interview-mutation nb-card-body.dialog-body',
	nameFilterInputCss: 'input[placeholder="Candidate"]',
	titleFilterInputCss: 'input[placeholder="Title"]',
	nameTableCellCss: 'table > tbody > tr.angular2-smart-row:first-of-type > td:nth-child(2)',
	titleTableCellCss: 'table > tbody > tr.angular2-smart-row:first-of-type > td:nth-child(3)',
	tableOptionsButtonsCss: 'table > tbody > tr:first-of-type > td:last-of-type nb-icon',
	addInterviewerDropdownCss: '[ng-reflect-placeholder="Add Interviewer"]',
	ratingInputCss: 'ga-star-rating-input > div.rating div.rating-star > span.rating-star-icon',
	radioGroupCss: 'nb-radio-group > nb-radio',
	radioGroupInputCss: 'nb-radio-group > nb-radio input.native-input',
	feedbackDescriptionCss: '#description',
	feedbackSaveButtonCss: 'nb-card button[status=success]',
	interviewCheckboxFiltersCss: 'nb-checkbox[status="basic"]',
	interviewCheckboxFiltersInputsCss: 'nb-checkbox[status="basic"] input.native-input',
	notesTableCellCss: 'table > tbody > tr > td:nth-child(9)',
	archiveInterviewOkButtonCss: 'nb-card-footer > button[status="danger"]',
	archiveBadgeCss: 'ga-interview-actions div.badges > div.badge',
	deleteButtonCss: 'ga-delete-interview button[status="danger"]',
	customCheckBoxCss: 'nb-checkbox[status="basic"] > span.custom-checkbox'
};
