export const SalesEstimatesPage = {
	gridButtonCss: 'div.layout-switch > button',
	addButtonCss: 'div.actions-container button[status="success"]',
	// Text-scope: the toolbar has two `button.action.primary` (Edit + Download) — without the text
	// filter index 0 is fragile and could land on Download if markup order shifts.
	editButtonCss: 'div.btn-group button.action.primary:has-text("Edit")',
	convertToInvoiceButton: 'div.btn-group button.action.info',
	// Text-scope: only one `button.action.secondary` (View) exists for estimates; scoping by text
	// keeps the match unambiguous and lets clickViewButton use index 0.
	viewButtonCss: 'div.btn-group button.action.secondary:has-text("View")',
	popoverButtonCss: 'div.popover-container-action button.action',
	deleteButtonCss: 'div.popover-container-action button.action.danger',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	discountInputCss: '#inputDiscountValue',
	discountTypeDropdownCss: '[formcontrolname="discountType"]',
	dropdownOptionCss: '.option-list nb-option',
	organizationContactDropdownCss: 'ga-contact-select ng-select',
	contactOptionCss: 'div.ng-option',
	taxInputCss: '#inputTax',
	taxTypeDropdownCss: '[formcontrolname="taxType"]',
	invoiceTypeDropdownCss: '[formcontrolname="invoiceType"]',
	generateItemsButtonCss: 'div.buttons > button.gen',
	selectEmployeeCss: 'div.form-group ga-employee-multi-select nb-select',
	saveAsDraftButtonCss: 'nb-card-footer > button[status="primary"]',
	emailInputCss: '#email',
	// Data row only — `tr.angular2-smart-row` excludes the header/filter rows that the bare
	// `tbody tr` selector also matched (clicking those does not toggle row selection).
	tableRowCss: 'table > tbody > tr.angular2-smart-row',
	moreButtonCss: 'div.btn-group button:has(nb-icon[icon="more-vertical-outline"])',
	toastrMessageCss: 'nb-toast.ng-trigger',
	cardBodyCss: 'nb-card-header.d-flex',
	backButtonCss: 'ngx-back-navigation button',
	deleteItemCss: 'i.nb-trash',
	confirmButtonCss: 'nb-card-footer.text-left > button[status="success"]',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	verifyEstimateCss: 'div.ng-star-inserted',
	draftBadgeCss: 'div.badge-warning',
	successBadgeCss: 'div.badge-success',
	emailCardCss: 'nb-card-body.invoice-email-body'
};
