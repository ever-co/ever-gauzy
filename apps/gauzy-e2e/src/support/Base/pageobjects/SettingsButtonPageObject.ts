export const SettingsButton = {
	// Opens the "Quick Settings" sidebar.
	settingsButtonCss: 'nb-action.toggle-layout:last-of-type',
	// The sidebar itself: carries `collapsed` when closed / `expanded` when open.
	settingsSidebarCss: 'nb-sidebar.settings-sidebar',
	// The three nb-select dropdowns inside Quick Settings, in DOM order:
	//   index 0 = Language, index 1 = Themes, index 2 = Layout.
	dropdownButtonCss: 'nb-sidebar.settings-sidebar nb-select > button.select-button',
	// Caption shown on the selected dropdown button (used to assert language).
	languageButtonCss: 'nb-sidebar.settings-sidebar nb-select > button.select-button',
	dropdownOptionCss: '.option-list nb-option',
	// Light/Dark switch — toggling it swaps the body theme class.
	lightDarkToggleCss: 'nb-sidebar.settings-sidebar nb-toggle',
	resetLayoutButtonCss: 'div.reset-button > button[status="danger"]',
	bodyCss: 'body'
};
