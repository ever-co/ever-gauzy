export const ExpensesPage = {
	gridButtonCss: 'div.layout-switch > button',
	addExpenseButtonCss: 'div.actions-container button[status="success"]',
	selectEmployeeDropdownCss: 'ga-employee-selector.employees',
	selectEmployeeDropdownOptionCss: 'div.ng-option',
	categoryInputCss: 'ga-expenses-mutation ga-expense-category-select ng-select',
	categorySearchInputCss: 'ga-expenses-mutation ga-expense-category-select ng-select input[type="text"]',
	dateInputCss: 'ga-expenses-mutation [formcontrolname="valueDate"]',
	vendorInputCss: 'ga-expenses-mutation ga-vendor-select ng-select',
	vendorSearchInputCss: 'ga-expenses-mutation ga-vendor-select ng-select input[type="text"]',
	organizationContactCss: 'ga-expenses-mutation ga-contact-select ng-select',
	organizationContactSearchInputCss: 'ga-expenses-mutation ga-contact-select ng-select input[type="text"]',
	amountInputCss: 'ga-expenses-mutation [formcontrolname="amount"]',
	projectDropdownCss: 'ga-expenses-mutation ga-project-selector ng-select',
	projectDropdownOptionCss: 'div.ng-option',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	purposeInputCss: 'ga-expenses-mutation textarea[formcontrolname="purpose"]',
	saveExpenseButtonCss: 'ga-expenses-mutation nb-card-footer > button[status="success"]',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	editExpenseButtonCss: 'div.actions-container button.action.primary:has-text("Edit")',
	deleteExpenseButtonCss: 'div.actions-container button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	// The inert dialog TITLE (an <h4>/<h5> heading, no click handler) — a safe in-dialog outside-click
	// target to close an open ng-select overlay without closing the dialog. Covers BOTH dialogs this spec
	// drives: the add/edit expense dialog (ga-expenses-mutation, h4.title) AND the add-category dialog
	// (ngx-expense-category-mutation, h5.title). NOT nb-card-header itself / the X close icon
	// (.cancel > i.fas.fa-times -> close()) and NOT Escape — both dialogs default to closeOnEsc=true, so a
	// document Escape would close the whole dialog (the round-4 failure: Save button gone, grid showing).
	cardBodyCss:
		'ga-expenses-mutation nb-card-header .title, ngx-expense-category-mutation nb-card-header .title',
	duplicateExpenseButtonCss: 'div.actions-container button.action.primary:has-text("Duplicate")',
	manageCategoriesButtonCss: 'div.card-header-title > button.action.primary.soft',
	expenseNameInputCss: '[placeholder="Expense name"]',
	SaveCategoryButtonCss: 'nb-card-footer > button[status="success"]',
	backButtonCss: 'div.main > button[status="primary"]',
	categoryCardCss: 'nb-card.main',
	toastrMessageCss: 'nb-toast.ng-trigger',
	notBillableBadgeCss: 'table > tbody > tr.angular2-smart-row',
	verifyCategoryCss: 'ga-notes-with-tags',
	sidebarBtnCss: 'span.menu-title',
	accountingExpensesSidebarBtnCss: 'a[href="#/pages/accounting/expenses"] > span.menu-title',
	reportsExpenseSidebarBtnCss: 'a[href="#/pages/reports/expense"] > span.menu-title',
	expenseTableCellCss: 'div[class="col-sm-2 project-name"] > span.ng-star-inserted',
	amountTableCellCss: 'div[class="col text-center day-col"]',
	groupByCss: 'div.ml-3 > nb-select > button.select-button',
	dropdownOptionCss: '.option-list nb-option'
};
