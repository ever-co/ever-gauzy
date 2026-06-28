export const PaymentsPage = {
	gridButtonCss: 'div.layout-switch > button',
	addPaymentButtonCss: '.gauzy-button-container button[status="success"]',
	dateInputCss: '[formcontrolname="paymentDate"]',
	vendorInputCss: '[formcontrolname="vendor"]',
	projectDropdownCss: '[formcontrolname="projectId"]',
	projectDropdownOptionCss: 'div.ng-option',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	paymentMethodDropdownCss: '[formcontrolname="paymentMethod"]',
	paymentMethodDropdownOptionCss: '.option-list nb-option',
	amountInputCss: '#inputAmount',
	noteInputCss: '#inputNote',
	saveExpenseButtonCss: 'nb-card-footer > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	editPaymentButtonCss: '.gauzy-button-container button.action.primary',
	deletePaymentButtonCss: '.gauzy-button-container button:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	// The inert dialog TITLE (the <h5 class="title"> in the payment-add nb-card-header, no click handler)
	// — a safe in-dialog outside-click target to close an open ng-select overlay WITHOUT closing the
	// dialog. Mirrors the verified-green Expenses.cardBodyCss. NOT the header's .cancel > i.fas.fa-times
	// (-> cancel()) and NOT Escape: the payment dialog is opened with NbDialog defaults (closeOnEsc=true),
	// so a document-level Escape would close the WHOLE dialog (the round-4 failure here: by the projectId
	// step the dialog was gone and the payments grid was showing).
	cardBodyCss: 'ga-payment-add nb-card-header .title',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// The note value renders in a smart-table text cell; verify against the data rows (filter-by-text in
	// the util). 'div.ng-star-inserted' matched thousands of unrelated nodes — unreliable for both the
	// exists-check and the not-exists-after-delete check.
	verifyPaymentCss: 'table > tbody > tr.angular2-smart-row',
	sidebarBtnCss: 'span.menu-title',
	accountingPaymentsSidebarBtnCss: 'a[href="#/pages/accounting/payments"] > span.menu-title',
	reportsPaymentsSidebarBtnCss: 'a[href="#/pages/reports/payments"] > span.menu-title',
	paymentTableCellCss: 'div[class="col-sm-2 project-name"] > span.ng-star-inserted',
	amountTableCellCss: 'div[class="col text-center day-col"]',
	groupByCss: 'div.ml-3 > nb-select > button.select-button',
	dropdownOptionCss: '.option-list nb-option'
};
