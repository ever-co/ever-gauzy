// The candidate-statistic route renders inside the `ga-candidate-statistic` host. The app shell also
// renders ~11 OTHER `nb-accordion-item-header`s in the sidebar nav (each collapsible `ga-menu-item`
// group is an nb-accordion), so an unscoped `nb-accordion-item-header` index 0-3 hits sidebar menus,
// not the chart accordions — every selector below is scoped to the host to target only this page.
const HOST = 'ga-candidate-statistic';

export const StatisticPage = {
	headerTextCss: `${HOST} nb-card-header > h4`,
	subheaderTextCss: `${HOST} nb-accordion-item-header > h6`,
	accordionItemCss: `${HOST} nb-accordion-item-header`,
	// Each candidate-statistic chart renders `<div class="no-data">...<span>No data yet</span></div>`
	// when there is no rating data (the seeded Default Company has candidates but no aggregated ratings).
	// Scope to the currently-expanded item: a collapsed nb-accordion-item-body keeps its chart in the DOM
	// but with `visibility:hidden; height:0`, so the span is present yet NOT visible. `:not(.collapsed)`
	// targets only the open accordion's body, so the assertion sees a genuinely visible span.
	noDataTextCss: `${HOST} nb-accordion-item:not(.collapsed) div.no-data span`
};
