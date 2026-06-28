export const EstimatesPage = {
	gridButtonCss: 'div.layout-switch > button',
	tabButtonCss: 'ul.tabset > li.tab  > a.tab-link',
	addButtonCss: 'div.actions-container button[status="success"]',
	editButtonCss: 'div.btn-group button.action.primary:has-text("Edit")',
	convertToInvoiceButton: 'div.btn-group button.action.info',
	viewButtonCss: 'div.btn-group button.action.secondary:has-text("View")',
	popoverButtonCss: 'div.popover-container-action button.action',
	deleteButtonCss: 'div.popover-container-action button.action.danger',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	discountInputCss: '#inputDiscountValue',
	discountTypeDropdownCss: '[formcontrolname="discountType"]',
	dropdownOptionCss: '.option-list nb-option',
	// Scope to the component, not a brittle column-class chain: the contact ng-select is the only
	// ga-contact-select on the add form (matches the proven Invoices/SalesEstimates selector).
	organizationContactDropdownCss: 'ga-contact-select ng-select',
	contactOptionCss: 'div.ng-option',
	taxInputCss: '#inputTax',
	taxTypeDropdownCss: '[formcontrolname="taxType"]',
	invoiceTypeDropdownCss: '[formcontrolname="invoiceType"]',
	generateItemsButtonCss: 'div.buttons > button.gen',
	selectEmployeeCss: 'div.form-group ga-employee-multi-select nb-select',
	// "Save as Draft" renders status="primary" (the success buttons are Save-and-send-contact /
	// Save-and-send-email). The old status="success" selector matched the wrong footer buttons.
	saveAsDraftButtonCss: 'nb-card-footer > button[status="primary"]',
	emailInputCss: '#email',
	tableRowCss: 'table > tbody > tr.angular2-smart-row',
	moreButtonCss: 'div.btn-group button:has(nb-icon[icon="more-vertical-outline"])',
	toastrMessageCss: 'nb-toast.ng-trigger',
	cardBodyCss: 'nb-card-header.d-flex',
	// Scope to the back-navigation component (matches the proven Invoices/SalesEstimates selector);
	// `div.main > button[status="primary"]` can collide with other primary buttons on view/send screens.
	backButtonCss: 'ngx-back-navigation button',
	deleteItemCss: 'i.nb-trash',
	// Send/Email mutation footer is `nb-card-footer.text-left`; scope to it so the confirm (success)
	// button isn't confused with the add-form footer's success buttons.
	confirmButtonCss: 'nb-card-footer.text-left > button[status="success"]',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	verifyEstimateCss: 'div.ng-star-inserted',
	draftBadgeCss: 'div.badge-warning',
	successBadgeCss: 'div.badge-success',
	emailCardCss: 'nb-card-body.invoice-email-body',
	inputInvoiceNumberCss: '#inputInvoiceNumber',
	estimateDateCss: '#inputInvoiceDate',
	dueDateInputCss: '#inputDueDate',
	totalValueInputCss: '#inputTotalValue',
	currencySelectCss: 'ga-currency ng-select',
	inputStatusCss: '#inputStatus',
	searchButtonCss: 'button[type="submit"][status="success"]',
	resetButtonCss: 'button[type="reset"]'
};
