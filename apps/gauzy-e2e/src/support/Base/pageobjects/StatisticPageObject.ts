export const StatisticPage = {
	headerTextCss: 'nb-card-header > h4',
	subheaderTextCss: 'nb-accordion-item-header > h6',
	accordionItemCss: 'nb-accordion-item-header',
	// Each candidate-statistic chart renders `<div class="no-data">...<span>No data yet</span></div>`
	// when there is no rating data (the seeded Default Company has candidates but no aggregated ratings).
	// Scope to the currently-expanded item (Nebular marks collapsed items with `.collapsed`) so the
	// assertion targets only the open accordion's body, never a hidden span left in a collapsed body.
	noDataTextCss: 'nb-accordion-item:not(.collapsed) div.no-data span'
};
