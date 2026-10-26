export const ReportsPage = {
	headerTextCss: 'nb-card-header > h4',
	subheaderTextCss: 'h5.report-category-name',
	// Reports UI polish (#10289, f0bce080a9): each report is an `nb-card.report-card` whose header
	// holds the `h6.report-name` and the "show in menu" nb-toggle directly — the old
	// `div.custom-view-report > nb-card > div.row.align-items-center > h6` wrapper is gone.
	titleCss: 'nb-card.report-card nb-card-header.report-card-header > h6.report-name',
	// Scope to the report cards — NOT a bare 'nb-toggle input.native-input'. The always-present Quick
	// Settings sidebar renders a gauzy-switch-theme nb-toggle (Light/Dark) that is FIRST in DOM order and
	// unchecked, so the bare selector made index 0 the theme switch and shifted every report toggle by
	// one. Scoping to the report cards (`nb-card.report-card` since #10289; `.custom-view-report` before)
	// maps index 0..10 exactly to the 11 report "show in menu" toggles (all seeded checked).
	checkboxCss: 'nb-card.report-card nb-card-header.report-card-header nb-toggle input.native-input',
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
