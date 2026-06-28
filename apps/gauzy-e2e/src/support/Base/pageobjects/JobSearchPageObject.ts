export const JobSearchPage = {
	// The Job Search title-input only renders inside the "Search" tab (the default active tab is
	// "Browse"/ACTIONS), so the spec must activate the Search tab first via searchTabCss.
	searchTabCss: 'a.tab-link',
	searchInputCss: '[placeholder="Job Search"]',
	// The old standalone Filter button (div.col-auto > button[status="info"]) was removed; the
	// advanced filter is now a set of nb-selects inside the Search tab. Point the "filter visible"
	// check at the Source filter select (#jobSource), which proves the filter form rendered.
	filterButtonCss: 'nb-select#jobSource',
	hideAllButtonCss: 'button:has-text("Hide All")',
	refreshButtonCss: 'button.refresh-button',
	nbToggleCss: 'div.toggle',
	inputCheckBoxCss: 'input.native-input',
	viewButtonCss: 'button.action.secondary',
	applyButtonCss: 'button.action.success',
	hideButtonCs: 'button.action.warning',
	confirmHideJobsButtonCss: 'nb-card-footer > button[status="primary"]',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
