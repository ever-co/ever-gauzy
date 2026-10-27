// Selectors for the accounting Invoices pages (apps/gauzy/src/app/pages/invoices/**, isEstimate = false).
// The list is `ngx-invoices`, the add / edit / view routes are `ga-invoice-add` / `ga-invoice-edit` /
// `ga-invoice-view`, and the send / email dialogs are `ga-invoice-send` / `ga-invoice-email`. Every
// selector is scoped to its component host so a leftover page, dialog or overlay can never match first.
export const InvoicesPage = {
	gridButtonCss: 'div.layout-switch > button',
	tabButtonCss: 'ngx-invoices ul.tabset > li.tab > a.tab-link',
	addButtonCss: 'ngx-invoices div.actions-container button[status="success"]',
	// Toolbar buttons by their eva icon (language-independent). View moved from `action secondary` to
	// `action primary` in 5536f7b711 (2026-09-27), so the old `.secondary` View selector matched nothing.
	editButtonCss: 'ngx-invoices div.btn-group.actions button.action:has(nb-icon[icon="edit-outline"])',
	// Toolbar "Set Status" nb-select (invoices only; options render as nb-option in .option-list).
	setStatusButtonCss: 'ngx-invoices div.btn-group.actions nb-select.select-nb',
	viewButtonCss: 'ngx-invoices div.btn-group.actions button.action:has(nb-icon[icon="eye-outline"])',
	moreButtonCss: 'ngx-invoices div.btn-group.actions button.action:has(nb-icon[icon="more-vertical-outline"])',
	// The "more" popover renders in a cdk overlay (outside ngx-invoices).
	popoverCss: 'div.popover-container-action',
	popoverButtonCss: 'div.popover-container-action button.action',
	deleteButtonCss: 'div.popover-container-action button.action.danger',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	discountInputCss: '#inputDiscountValue',
	discountTypeDropdownCss: '[formcontrolname="discountType"]',
	dropdownOptionCss: '.option-list nb-option',
	// The add form wraps the contact select in a div.form-group (8c5c24396e), the edit form does not —
	// scope by the form component instead of a column/child chain.
	organizationContactDropdownCss: ':is(ga-invoice-add, ga-invoice-edit) ga-contact-select ng-select',
	contactOptionCss: 'ng-dropdown-panel div.ng-option',
	taxInputCss: '#inputTax',
	taxTypeDropdownCss: '[formcontrolname="taxType"]',
	invoiceTypeDropdownCss: '[formcontrolname="invoiceType"]',
	generateItemsButtonCss: 'ga-invoice-add div.buttons > button.gen',
	generatedItemRowCss: 'ga-invoice-add .table-scroll-container table > tbody > tr.angular2-smart-row',
	selectEmployeeCss: 'ga-invoice-add ga-employee-multi-select nb-select',
	// Options of that multi nb-select (employee-multi-select.component.html: nb-option.employee-option), so a
	// still-detaching option list of the invoice-type select can never be picked instead.
	employeeOptionCss: '.option-list nb-option.employee-option',
	// "Save as Draft" is the footer's status="primary" button on both the add and the edit form.
	saveAsDraftButtonCss: ':is(ga-invoice-add, ga-invoice-edit) nb-card-footer > button[status="primary"]',
	formSpinnerCss: ':is(ga-invoice-add, ga-invoice-edit) nb-spinner',
	editFormInvoiceNumberCss: 'ga-invoice-edit #inputInvoiceNumber',
	emailInputCss: 'ga-invoice-email textarea#email',
	tableRowCss: 'ngx-invoices table > tbody > tr.angular2-smart-row',
	listSpinnerCss: 'ngx-invoices nb-spinner',
	toastrMessageCss: 'nb-toast',
	// Header title of the add/edit form: clicking it closes an open ng-select panel and is inert
	// (the header also hosts the back-navigation button, which must NOT be clicked here).
	cardBodyCss: ':is(ga-invoice-add, ga-invoice-edit) nb-card-header h4',
	backButtonCss: ':is(ga-invoice-edit, ga-invoice-view) ngx-back-navigation button',
	deleteItemCss: 'i.nb-trash',
	// Send / Email dialogs; `nb-card-footer.text-left` is their documented e2e hook for the confirm row.
	mutationDialogCss: 'ga-invoice-send, ga-invoice-email',
	confirmButtonCss: 'nb-card-footer.text-left > button[status="success"]',
	dialogConfirmButtonCss:
		':is(ga-invoice-send, ga-invoice-email) nb-card-footer.text-left > button[status="success"]',
	confirmDeleteButtonCss: 'ga-delete-confirmation nb-card-footer > button[status="danger"]',
	verifyInvoiceCss: 'tr.ng-star-inserted > td',
	draftBadgeCss: 'ngx-invoices div.badge-warning',
	successBadgeCss: 'ngx-invoices div.badge-success',
	emailCardCss: 'ga-invoice-email nb-card-body.invoice-email-body',
	// Search tab of the list (the add form reuses some of these ids, hence the ngx-invoices scope).
	inputInvoiceNumberCss: 'ngx-invoices #inputInvoiceNumber',
	estimateDateCss: 'ngx-invoices #inputInvoiceDate',
	dueDateInputCss: 'ngx-invoices #inputDueDate',
	totalValueInputCss: 'ngx-invoices #inputTotalValue',
	currencySelectCss: 'ngx-invoices ga-currency ng-select',
	inputStatusCss: 'ngx-invoices #inputStatus',
	searchButtonCss: 'ngx-invoices button[type="submit"][status="success"]',
	resetButtonCss: 'ngx-invoices button[type="reset"]'
};
