export const ReportsPage = {
	headerTextCss: 'nb-card-header > h4',
	subheaderTextCss: 'h5.report-category-name',
	titleCss: 'div.align-items-center > h6',
	// Scope to nb-toggle: 'input.native-input' is shared by every nb-checkbox/nb-radio/nb-toggle on
	// the page, so the bare selector picks up unrelated controls and shifts the indices. The report
	// "show in menu" switches are nb-toggles, so this maps index 0..10 exactly to the 11 report cards.
	checkboxCss: 'nb-toggle input.native-input',
	sidebarBtnCss: 'span.menu-title',
	totalHoursCss:
		'ga-daily-statistics > div.row > div.col-sm-4 > nb-card > nb-card-body > div.h1',
	sliderBtnCss:
		'div[class="col-auto filter-item ml-auto pl-1 ng-star-inserted"] > button[status="basic"]',
	sliderCss: 'ng5-slider.ng5-slider',
	timeAndActivityProjectCss:
		'div[class="col-sm-2 project-name"] > span.ng-star-inserted',
	amountOwedEmployeeCss:
		'div[class="col-sm-3 employee-name"] > ngx-avatar > div[class="row align-items-center"] > div.col > a',
	projectsBudgetsProjectCss:
		'div[class="col-3 project-name"] > span.ng-star-inserted',
	clientsBudgetsClientCss:
		'div[class="col-3 client-name"] > span.ng-star-inserted',
	progressContainerCss: 'div.progress-container > div.progress-value > span.ng-star-inserted'
};
