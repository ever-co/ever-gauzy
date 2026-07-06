export const SalesInvoicesPage = {
	gridButtonCss: 'div.layout-switch > button',
	addButtonCss: 'div.actions-container button[status="success"]',
	editButtonCss: 'div.btn-group.actions button.action.primary',
	setStatusButtonCss: 'div.btn-group.actions nb-select',
	// View and Payments are BOTH `button.action.secondary` in the toolbar (View first, Payments second
	// for non-estimate invoices). Scope to the eye-outline icon so View — not Payments — is targeted.
	viewButtonCss: 'div.btn-group.actions button.action.secondary:has(nb-icon[icon="eye-outline"])',
	popoverButtonCss: 'div.popover-container-action button',
	deleteButtonCss: 'div.popover-container-action button.danger',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	discountInputCss: '#inputDiscountValue',
	discountTypeDropdownCss: '[formcontrolname="discountType"]',
	dropdownOptionCss: '.option-list nb-option',
	organizationContactDropdownCss: 'div.col-sm-6 > ga-contact-select > ng-select',
	contactOptionCss: 'div.ng-option',
	taxInputCss: '#inputTax',
	taxTypeDropdownCss: '[formcontrolname="taxType"]',
	invoiceTypeDropdownCss: '[formcontrolname="invoiceType"]',
	generateItemsButtonCss: 'div.buttons > button.gen',
	selectEmployeeCss: 'div.form-group ga-employee-multi-select nb-select',
	saveAsDraftButtonCss: 'nb-card-footer > button[status="primary"]',
	emailInputCss: '#email',
	moreButtonCss: 'div.btn-group.actions button:has(nb-icon[icon="more-vertical-outline"])',
	// Data rows only. The previous `angular2-smart-table tbody tr` also matched the filter row and the
	// "no data" placeholder row; the real rows carry the `angular2-smart-row` class (verified against
	// the angular2-smart-table tbody template).
	tableRowCss: 'table > tbody > tr.angular2-smart-row',
	toastrMessageCss: 'nb-toast.ng-trigger',
	cardBodyCss: 'nb-card-header.d-flex',
	backButtonCss: 'ngx-back-navigation button',
	deleteItemCss: 'i.nb-trash',
	confirmButtonCss: 'nb-card-footer.text-left > button[status="success"]',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	verifyInvoiceCss: 'tr.ng-star-inserted > td',
	draftBadgeCss: 'div.badge-warning',
	successBadgeCss: 'div.badge-success',
	emailCardCss: 'nb-card-body.invoice-email-body'
};
