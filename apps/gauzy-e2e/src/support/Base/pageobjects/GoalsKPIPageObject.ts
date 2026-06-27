export const GoalsKPIPage = {
	gridButtonCss: 'div.layout-switch > button',
	tabButtonCss: 'nb-tabset > ul.tabset > li.tab',
	kpiTitleInputCss: '#kpi-title',
	kpiDescriptionInputCss: '#kpi-description',
	// Target the nb-select's clickable button inside the KPI-lead employee multi-select (a click on the
	// host id alone doesn't open the dropdown). Scoped by #kpi-lead so it only matches the lead select.
	employeeMultiSelectCss: '#kpi-lead nb-select button.select-button',
	employeeDropdownCss: '.option-list nb-option',
	currentValueInputCss: '#current-value',
	addKPIButtonCss: '.gauzy-button-container button[status="success"]',
	// Data rows only (the filter sub-header row is hidden for the KPI table; this is the canonical
	// smart-table data-row class used across the suite, so the row click hits a real KPI row).
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	saveKPIButtonCss: 'nb-card-footer > button[status="success"]',
	editButtonCss: '.gauzy-button-container button.action.primary',
	deleteButtonCss: '.gauzy-button-container button.action:has(nb-icon[status="danger"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="success"]',
	verifyKPICss: 'angular2-smart-table-cell div.ng-star-inserted',
	verifyEmptyTableCss: 'tr.ng-star-inserted > td',
	toastrMessageCss: 'nb-toast.ng-trigger',
	searchNameInputCss: 'input-filter > input[placeholder="Name"]'
};
