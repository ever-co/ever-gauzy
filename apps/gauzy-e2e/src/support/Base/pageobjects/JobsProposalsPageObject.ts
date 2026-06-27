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
	confirmDeleteButtonCss: 'nb-card-footer > button[status="primary"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyProposalCss: 'div.ng-star-inserted'
};
