export const RemoveUserPage = {
	gridButtonCss: 'div.layout-switch > button',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Full Name column filter input in the users smart-table header (tr.angular2-smart-filters). The
	// shared serial DB accumulates users (seed admin + faker employees from earlier specs' addEmployee),
	// so the grid paginates (e.g. "1 - 10 of 11") and the just-added user lands on page 2 — not rendered,
	// so a filter-by-text verify/select never finds it. Typing the unique name narrows the grid to that
	// one record so it is on page 1 and is the only data row. Column key is `fullName` (see users.component).
	nameFilterInputCss: 'th.angular2-smart-th.fullName input',
	removeButtonCss: 'div.actions button:has(nb-icon[icon="trash-2-outline"])',
	confirmRemoveUserButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyUserCss: 'ga-picture-name-tags a.link-text'
};
