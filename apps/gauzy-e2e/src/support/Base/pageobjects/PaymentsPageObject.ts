export const PaymentsPage = {
	gridButtonCss: 'div.layout-switch > button',
	addPaymentButtonCss: '.gauzy-button-container button[status="success"]',
	// IMPORTANT: every form control below is SCOPED to the ga-payment-add dialog. The payments grid's
	// FILTER ROW renders the SAME controls (the Tags column filter is a <ga-tags-color-input> => a SECOND
	// <ng-select id="addTags">, and there are paymentMethod/note/contact column filters too). Unscoped
	// '#addTags' / id selectors matched the grid filter (earlier in the DOM, so .first() picked it): the
	// keyboard tag-pick landed on the grid's Tags FILTER instead of the dialog, applying a where[tags] filter
	// to the grid while the payment saved with tags:null — so the created "Billable" payment was filtered OUT
	// and the grid showed "You have not received any payments." (confirmed in the trace: POST /api/payments
	// returned 201 with note:'Billable', tags:null, while the pagination refetch had where[tags][0]=<id>).
	dateInputCss: 'ga-payment-add [formcontrolname="paymentDate"]',
	vendorInputCss: '[formcontrolname="vendor"]',
	projectDropdownCss: 'ga-payment-add [formcontrolname="projectId"]',
	projectDropdownOptionCss: 'div.ng-option',
	addTagsDropdownCss: 'ga-payment-add #addTags',
	tagsDropdownOption: 'div.ng-option',
	paymentMethodDropdownCss: 'ga-payment-add [formcontrolname="paymentMethod"]',
	paymentMethodDropdownOptionCss: '.option-list nb-option',
	amountInputCss: 'ga-payment-add #inputAmount',
	noteInputCss: 'ga-payment-add #inputNote',
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
