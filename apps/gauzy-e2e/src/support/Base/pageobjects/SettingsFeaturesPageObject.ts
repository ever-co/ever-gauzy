export const SettingsFeaturesPage = {
	headerTextCss: 'nb-card-header > h4.email-history-header',
	// Settings features polish (#10439, 418bc244c6): the feature-toggle card header is now
	// `nb-card-header.feature-page-header > h5.feature-page-title` ("Manage Features for '<tenant>'"),
	// not a bare `<header>`.
	subheaderTextCss: 'nb-card.card-feature nb-card-header.feature-page-header > h5.feature-page-title',
	tabButtonCss: 'ul.route-tabset > li.route-tab > a.tab-link',
	// One `section.settings-group` per feature: `header.group-header` holds the icon, the
	// `h6.group-title` (name), the `p.group-description` and the feature's master nb-toggle; each
	// sub-feature is a `.setting-row > nb-checkbox` below it. (Was a masonry of nb-cards with the
	// description in `div.row > div.col-10` and the toggle in `div.col-2`.)
	featureGroupCss: 'nb-card.card-feature section.settings-group',
	featureToggleInputCss: 'header.group-header nb-toggle input.native-input',
	subFeatureCss: '.setting-row nb-checkbox',
	textCss: 'nb-card.card-feature section.settings-group .setting-row nb-checkbox span.text',
	mainTextCss: 'nb-card.card-feature section.settings-group p.group-description'
};
