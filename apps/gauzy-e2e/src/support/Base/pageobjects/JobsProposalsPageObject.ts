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
	// The trash button opens DeleteConfirmationComponent; its OK button has status="danger".
	confirmDeleteButtonCss: 'ga-delete-confirmation nb-card-footer button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// Scope the row assertions to the GRID (mirrors ProposalsPageObject). 'div.ng-star-inserted' matched
	// every Angular-inserted div on the page, so "the proposal exists" could be satisfied by anything the
	// create/edit dialog still had mounted — the proposal's own form, an ng-select label, a chip — rather
	// than by a committed row. The mirror assertion 'is it deleted?' is weakened the same way: it passes
	// as soon as the text disappears from ANY div, grid included or not.
	verifyProposalCss: 'angular2-smart-table'
};
