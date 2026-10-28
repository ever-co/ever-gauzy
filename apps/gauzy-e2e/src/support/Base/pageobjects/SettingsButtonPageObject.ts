export const SettingsButton = {
	// Opens the "Quick Settings" sidebar.
	settingsButtonCss: 'nb-action.toggle-layout:last-of-type',
	// The sidebar itself: carries `collapsed` when closed / `expanded` when open.
	settingsSidebarCss: 'nb-sidebar.settings-sidebar',
	// The two nb-select dropdowns inside Quick Settings, in DOM order:
	//   index 0 = Language, index 1 = Layout.
	// Themes used to be a (fake) nb-select at index 1; since the professional-panel redesign
	// (#10044, 01171bba2e) it is a `gauzy-theme-selector-image button.theme-trigger` opening a popover.
	dropdownButtonCss: 'nb-sidebar.settings-sidebar nb-select > button.select-button',
	// Caption shown on the selected dropdown button (used to assert language).
	languageButtonCss: 'nb-sidebar.settings-sidebar nb-select > button.select-button',
	dropdownOptionCss: '.option-list nb-option',
	// Light/Dark switch — toggling it swaps the body theme class. Scoped to its own component host so
	// no other toggle the panel may grow can be picked up by `.first()`.
	lightDarkToggleCss: 'nb-sidebar.settings-sidebar gauzy-switch-theme nb-toggle',
	// "Reset layout" button inside the Layout selector. The Quick-Settings redesign replaced the old
	// `<div class="reset-button"><button status="danger">` with a `<div class="layout-control">` column
	// holding the layout nb-select plus `<button class="reset-layout" status="basic" outline size="tiny">`
	// (packages/ui-core/theme/.../theme-settings/components/layout-selector/layout-selector.component.html).
	// Anchor on the stable `reset-layout` class rather than the status attribute, which the redesign churns.
	resetLayoutButtonCss: 'nb-sidebar.settings-sidebar div.layout-control button.reset-layout',
	bodyCss: 'body'
};
