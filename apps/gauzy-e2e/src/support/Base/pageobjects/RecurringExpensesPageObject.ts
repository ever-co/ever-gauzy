export const RecurringExpensesPage = {
	// The Add button lives in the header's gauzy-button-action (#visible template) and carries
	// status="success"; scope to the header container so we don't match the dialog's own
	// status="success" Save button.
	addNewExpenseButtonCss: '.gauzy-button-container button[status="success"]',
	employeeDropdownCss: 'ga-recurring-expense-mutation ga-employee-selector ng-select',
	dropdownOptionCss: 'div.ng-option',
	expenseDropdownCss: 'ga-recurring-expense-mutation #categoryInput',
	valueInputCss: 'ga-recurring-expense-mutation #valueInput',
	saveExpenseButtonCss: 'nb-card-footer > button[status="success"]',
	// Per-row gear; presence confirms a block rendered. Hidden (display:none) by the stylesheet.
	settingsButtonCss: 'nb-icon[icon="settings-2-outline"]',
	// The edit/delete actions live on the `.single-setting` divs inside the per-block menu (that's
	// where the (click) handlers are). Target the div, not the inner nb-icon, so a non-bubbling
	// dispatched click hits the handler without re-toggling the row selection. (Same pattern as the
	// org-level OrganizationRecurringExpenses spec, which tests the identical redesigned page.)
	editExpenseButtonCss: 'div.block-settings div.single-setting:has(nb-icon[icon="edit-outline"])',
	deleteExpenseButtonCss: 'div.block-settings div.single-setting:has(nb-icon[icon="close-outline"])',
	// The visible amount column of an expense row; clicking it bubbles to (click)="selectRecurringExpense".
	expenseBlockCss: 'ga-recurring-expense-block div.expense > div.block-item > span.block-amount',
	deleteAllButtonCss: 'nb-radio[value="all"]',
	confirmDeleteExpenseButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// For EMPLOYEE expenses the spec asserts on the VALUE, rendered (currency-formatted) in
	// <span class="block-amount"> within div.expense > div.block-item.
	verifyExpenseCss: 'div.expense > div.block-item > span.block-amount'
};
