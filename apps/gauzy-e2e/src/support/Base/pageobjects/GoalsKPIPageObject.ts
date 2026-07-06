export const GoalsKPIPage = {
	gridButtonCss: 'div.layout-switch > button',
	tabButtonCss: 'nb-tabset > ul.tabset > li.tab',
	kpiTitleInputCss: '#kpi-title',
	kpiDescriptionInputCss: '#kpi-description',
	// The KPI-lead employee multi-select renders a Nebular nb-select (ga-employee-multi-select host has
	// id="kpi-lead"). Target the nb-select host (not button.select-button): clicking the host is what
	// reliably toggles the overlay panel open — matching the ContactsLeads usersMultiSelect pattern.
	employeeMultiSelectCss: '#kpi-lead nb-select',
	employeeDropdownCss: '.option-list nb-option',
	currentValueInputCss: '#current-value',
	addKPIButtonCss: '.gauzy-button-container button[status="success"]',
	// Data rows only, scoped to the ACTIVE tab body. Both the KPI and Time-Frame nb-tabs render the same
	// #tableLayout (a smart-table each) over the same shared smartTableData, and the inactive timeframe
	// tab (declared first) stays in the DOM as display:none. An unscoped row selector's .first()/.nth(0)
	// would target the HIDDEN timeframe copy — clicking it never selects a row in the visible table, so
	// the toolbar Edit/Delete never enables. 'nb-tab.content-active' restricts to the visible KPI table.
	selectTableRowCss: 'nb-tab.content-active table > tbody > tr.angular2-smart-row',
	saveKPIButtonCss: 'nb-card-footer > button[status="success"]',
	editButtonCss: '.gauzy-button-container button.action.primary',
	deleteButtonCss: '.gauzy-button-container button.action:has(nb-icon[status="danger"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="success"]',
	// Scope verify to the ACTIVE tab body. The KPI and Time-Frame nb-tabs both render the SAME
	// #tableLayout template (one <angular2-smart-table> each) bound to the same shared smartTableData,
	// so the created KPI row exists in BOTH tables. Nebular keeps inactive tab bodies in the DOM with
	// display:none (only the active tab gets .content-active), and the timeframe tab is declared first —
	// so an unscoped 'angular2-smart-table-cell div.ng-star-inserted'.first() resolves to the HIDDEN
	// copy and toBeVisible times out (confirmed in the failure DOM). 'nb-tab.content-active' picks the
	// visible KPI tab's table only.
	verifyKPICss: 'nb-tab.content-active angular2-smart-table-cell div.ng-star-inserted',
	verifyEmptyTableCss: 'tr.ng-star-inserted > td',
	toastrMessageCss: 'nb-toast.ng-trigger',
	searchNameInputCss: 'input-filter > input[placeholder="Name"]'
};
