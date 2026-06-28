export const IncomePage = {
	gridButtonCss: 'div.layout-switch > button',
	addIncomeButtonCss: 'div.actions-container button[status="success"]',
	// ga-employee-selector renders an appendTo=body ng-select (inner input opened via keyboard).
	selectEmployeeDropdownCss: 'ngx-income-mutation ga-employee-selector ng-select',
	selectEmployeeDropdownOptionCss: 'div.ng-option',
	dateInputCss: 'ngx-income-mutation [formcontrolname="valueDate"]',
	organizationContactCss: 'ngx-income-mutation ga-contact-select ng-select',
	organizationContactSearchInputCss: 'ngx-income-mutation ga-contact-select ng-select input[type="text"]',
	amountInputCss: 'ngx-income-mutation [formcontrolname="amount"]',
	addTagsDropdownCss: 'ngx-income-mutation #addTags',
	tagsDropdownOption: 'div.ng-option',
	notesInputCss: 'ngx-income-mutation textarea[formcontrolname="notes"]',
	saveIncomeButtonCss: 'ngx-income-mutation nb-card-footer > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Toolbar Edit/Delete gate on [disabled]="!selectedItem && disableButton" (no .btn-disabled class),
	// so the row-select poll reads the REAL `disabled` attribute on these toolbar buttons.
	editIncomeButtonCss: 'div.actions-container button.action.primary:has-text("Edit")',
	deleteIncomeButtonCss: 'div.actions-container button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	// The inert dialog TITLE (<h5 class="title">, no click handler) — a safe in-dialog outside-click target
	// to close an open ng-select overlay (tags has closeOnSelect=false) WITHOUT closing the dialog. NOT the
	// header's X icon (.cancel > i.fas.fa-times -> close()) and NOT Escape (the NbDialog defaults to
	// closeOnEsc=true, so a document Escape would close the whole add/edit income dialog).
	cardBodyCss: 'ngx-income-mutation nb-card-header .title',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyIncomeCss: 'table > tbody > tr.angular2-smart-row'
};
