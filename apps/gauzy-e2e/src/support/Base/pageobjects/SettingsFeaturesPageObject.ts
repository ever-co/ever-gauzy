export const SettingsFeaturesPage = {
	headerTextCss: 'nb-card-header > h4.email-history-header',
	// The feature-toggle card now renders its subheader via Angular @if control flow
	// (feature-toggle.component.html), which no longer emits the legacy `.ng-star-inserted`
	// class — match the plain `<header>` inside `nb-card-header` instead.
	subheaderTextCss: 'nb-card-header > header',
	tabButtonCss: 'ul.route-tabset > li.route-tab > a.tab-link',
	nbToggleCss: 'div.col-2 > nb-toggle',
	checkboxCss: 'input.native-input',
	textCss: 'span.text',
	mainTextCss: 'div.row > div.col-10'
};
