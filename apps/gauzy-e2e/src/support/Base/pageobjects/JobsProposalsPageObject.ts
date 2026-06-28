export const JobsProposalsPage = {
	addButtonCss: 'ngx-gauzy-button-action button[status="success"]',
	// nb-select trigger BUTTON (NbSelect renders button.select-button); clicking the host nb-select
	// element can miss the toggle / land on a leaked dialog backdrop — target the real trigger.
	selectEmployeeDropdownCss: 'ga-employee-multi-select button.select-button',
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	nameInputCss: '[formcontrolname="name"]',
	contentInputCss: '[formcontrolname="content"]',
	saveButtonCss: 'nb-card-footer.text-left > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	editButtonCss: 'ngx-gauzy-button-action button.action.primary',
	makeDefaultButtonCss: 'ngx-gauzy-button-action button.action.primary',
	deleteButtonCss: 'ngx-gauzy-button-action button.action:has(nb-icon[icon="trash-2-outline"])',
	// Delete is a TWO-dialog confirmation in this list component:
	//  1) the trash toolbar button carries the `ngxConfirmDialog` directive, which opens ConfirmComponent
	//     (selector ngx-confirm) — its confirm button is the "Yes" button[status="primary"];
	//  2) only on Yes does (confirm)="deleteProposalTemplate()" fire, which opens DeleteConfirmationComponent
	//     (selector ga-delete-confirmation) — its OK button is button[status="danger"] (Cancel is "basic").
	// Each is host-scoped so they can never cross-match each other or a toolbar status icon.
	confirmFirstDialogButtonCss: 'ngx-confirm nb-card-footer button[status="primary"]',
	confirmDeleteButtonCss: 'ga-delete-confirmation nb-card-footer button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyProposalCss: 'div.ng-star-inserted'
};
