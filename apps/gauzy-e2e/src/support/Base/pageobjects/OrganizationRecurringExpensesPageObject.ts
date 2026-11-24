export const OrganizationRecurringExpensesPage = {
	// Scope the Add button to the card header toolbar, away from any dialog footer.
	addButtonCss: '.gauzy-button-container button[status="success"]',
	// The category picker is an ng-select (opens on mousedown, panel appended to body).
	expenseDropdownCss: 'ga-recurring-expense-mutation #categoryInput',
	dropdownOptionCss: 'div.ng-option',
	valueInputCss: 'ga-recurring-expense-mutation #valueInput',
	// The mutation dialog's Save/Edit: its only submit button (Cancel is type="button").
	saveButtonCss: 'ga-recurring-expense-mutation nb-card-footer > button[type="submit"]',
	settingsButtonCss: 'nb-icon[icon="settings-2-outline"]',
	// The edit/delete actions live on the `.single-setting` divs (that's where the
	// (click) handlers are). Target the div, not the inner nb-icon, so a non-bubbling
	// dispatched click hits the handler without re-toggling the row selection.
	editButtonCss: 'div.block-settings div.single-setting:has(nb-icon[icon="edit-outline"])',
	deleteButtonCss: 'div.block-settings div.single-setting:has(nb-icon[icon="close-outline"])',
	// The visible part of the expense row; clicking it sets selectedRecurringExpense.
	expenseBlockCss: 'ga-recurring-expense-block div.expense > div.block-item-big',
	deleteOnlyThisRadioButtonCss: 'nb-radio[value="current"]',
	confirmDeleteExpenseButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// For ORGANIZATION expenses the block renders the category name (verbatim for
	// custom, translated for defaults) in `div.expense > div.block-item-big`.
	verifyExpenseCss: 'div.expense > div.block-item-big'
};
