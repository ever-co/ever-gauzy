export const HumanResourcesPage = {
	// Accounting dashboard employee rows: each clickable row is `.table-scrollable .block-content`
	// (the column-title header above the list is `.sub-header .block-content`, which we must NOT match).
	// Clicking a row calls selectEmployee() -> navigates to the HR dashboard (/pages/dashboard/hr).
	employeeRowCss: '.table-scrollable .block-content',
	// The employee name inside a row is rendered by ngx-avatar as `a.link-text`.
	employeeRowNameCss: '.table-scrollable ngx-avatar a.link-text',
	// HR dashboard header shows the selected employee's full name in `.employee-name`.
	employeeNameCss: '.employee-name',
	// HR dashboard cards are ga-info-block components; the title lives in `.info-block .info-text`
	// (the old `.statistic-component .title` was the accounting aggregate cards, not these per-employee ones).
	infoTextCss: '.info-block .info-text',
	// The clickable card element carrying the (click)="handleClick()" handler that opens the popup.
	infoBlockCss: '.info-block',
	chartDropdownCss: '[placeholder="Select chart"]',
	// nb-select options render into `.option-list nb-option`.
	dropdownOptionCss: '.option-list nb-option',
	// Records-history popup is `nb-card.records` with `<h5 class="title">` inside its header.
	popupHeaderCss: 'nb-card.records h5',
	// Profit-history popup is `nb-card.profit-history` with `<h5 class="title">` inside its header.
	popupProfitHeaderCss: 'nb-card.profit-history h5',
	// angular2-smart-table column headers render as `angular2-st-column-title`
	// (containing `a.angular2-smart-sort-link` or `span.angular2-smart-sort` with the column title).
	popupTableHederCss: 'angular2-st-column-title'
};
