export const HumanResourcesPage = {
	// Accounting dashboard employee rows: each clickable row is `.table-scrollable .block-content`
	// (the column-title header above the list is `.sub-header .block-content`, which we must NOT match).
	// Clicking a row calls selectEmployee() -> navigates to the HR dashboard (/pages/dashboard/hr).
	employeeRowCss: '.table-scrollable .block-content',
	// The employee name inside a row is rendered by ngx-avatar as `a.link-text`.
	employeeRowNameCss: '.table-scrollable ngx-avatar a.link-text',
	// The selected employee's name is read from the PAGE-HEADER employee selector label, not the HR
	// card's `.identity-name` span. Reason: clicking an accounting row calls accounting.selectEmployee()
	// which writes store.selectedEmployee WITHOUT `fullName`; the HR card binds `selectedEmployee.fullName`
	// (`human-resources.component.html`) so that span renders EMPTY via this path. The header
	// ga-employee-selector (`ng-select.employee` -> `ng-label-tmp`) instead renders the name from its own
	// employee list via getShortenedName(firstName,lastName), so it correctly shows e.g. "Default Employee".
	employeeNameCss: 'ng-select.employee .selector-template span',
	// The HR dashboard no longer renders ga-info-block. Its figures now live in two kinds of element:
	//   * `.kpi`      — the four headline tiles (Total Income, Total Expenses, Profit, Total Bonus)
	//   * `.stat-row` — the component rows in the Breakdown panel (Income, Direct Income,
	//                   Total Expense without salary, Salary, and the bonus components)
	// Titles are in the label span of each, never mixed with the `.kpi-meta` / `.stat-row-meta`
	// formula text — so a text filter here matches a heading and not the formula that quotes it.
	infoTextCss: '.kpi-label, .stat-row-label',
	// The clickable elements carrying the (click) handler that opens a history popup. Both are real
	// <button>s now (the old .info-block was a click handler on a div).
	//
	// A card's rendered text is NOT just its own heading and figure: each one also prints its
	// arithmetic as body text in `.kpi-meta` / `.stat-row-meta`, and that arithmetic quotes OTHER
	// cards' headings — PROFIT_CALC is "Profit (Net Income) = Total Income {x} - Total Expenses {y}".
	// Since Playwright's `hasText` is a CASE-INSENSITIVE SUBSTRING match over an element's whole
	// subtree, filtering these cards by "Total Income" or by "Total Expenses" matches the Profit tile
	// as well as the intended one. `clickCardByHeaderText` therefore scopes its text match to
	// `infoTextCss` (the label span) via `filter({ has: ... })` rather than matching the card whole —
	// otherwise which card got clicked would come down to which one `.first()` found in DOM order.
	// The Bonus tile is deliberately excluded: it is `.kpi--static` (a div) because there is no BONUS
	// history type to open.
	infoBlockCss: '.kpi:not(.kpi--static), .stat-row:not(.is-static)',
	// Placeholder lost its "Select " prefix along with every other combobox placeholder.
	chartDropdownCss: '[placeholder="Chart"]',
	// nb-select options render into `.option-list nb-option`.
	dropdownOptionCss: '.option-list nb-option',
	// Records-history popup is `nb-card.records` with `<h5 class="title">` inside its header.
	popupHeaderCss: 'nb-card.records h5',
	// Profit-history popup is `nb-card.profit-history` with `<h5 class="title">` inside its header.
	popupProfitHeaderCss: 'nb-card.profit-history h5',
	// Either history dialog (records OR profit) — used to confirm a card click actually opened a popup
	// so the open helper can retry the click if the first attempt didn't register.
	popupAnyCss: 'nb-card.records, nb-card.profit-history',
	// angular2-smart-table column headers render as `angular2-st-column-title`
	// (containing `a.angular2-smart-sort-link` or `span.angular2-smart-sort` with the column title).
	popupTableHederCss: 'angular2-st-column-title'
};
