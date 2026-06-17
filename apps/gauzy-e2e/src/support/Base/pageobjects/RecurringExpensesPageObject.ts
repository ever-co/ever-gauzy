export const RecurringExpensesPage = {
	addNewExpenseButtonCss: '.gauzy-button-container button[status="success"]',
	employeeDropdownCss: 'ga-recurring-expense-mutation ga-employee-selector ng-select',
	dropdownOptionCss: 'div.ng-option',
	expenseDropdownCss: 'ga-recurring-expense-mutation #categoryInput',
	valueInputCss: 'ga-recurring-expense-mutation #valueInput',
	saveExpenseButtonCss:
		'nb-card-footer > button[status="success"]',
	settingsButtonCss: 'nb-icon[icon="settings-2-outline"]',
	// The edit/delete actions live on the `.single-setting` divs (that's where the
	// (click) handlers are). Target the div, not the inner nb-icon, so a non-bubbling
	// dispatched click hits the handler without re-toggling the row selection.
	editExpenseButtonCss: 'div.block-settings div.single-setting:has(nb-icon[icon="edit-outline"])',
	deleteExpenseButtonCss: 'div.block-settings div.single-setting:has(nb-icon[icon="close-outline"])',
	expenseBlockCss: 'div.expense > div.block-item > span.block-amount',
	deleteAllButtonCss: 'nb-radio[value="all"]',
	confirmDeleteExpenseButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyExpenseCss: 'div.expense > div.block-item > span.block-amount'
};
