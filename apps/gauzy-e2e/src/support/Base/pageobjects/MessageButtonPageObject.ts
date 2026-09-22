export const MessageButton = {
	// The support entries (Support Chat / FAQ / Help / About) used to hang off a
	// speech-bubble `nb-action[icon="message-circle-outline"]` in the header. That
	// control was removed when the entries were folded into the Quick Settings
	// panel, so this spec opens Quick Settings instead.
	//
	// There is no attribute that identifies that trigger. It is rendered from
	// `navigationBuilderService.sidebarActions$` as
	// `<nb-action [icon]="action.icon" [class]="action.class">` — `[icon]` is a
	// PROPERTY binding, so no `icon="..."` attribute reaches the DOM, and the class
	// (`toggle-layout`) is shared with the changelog action registered beside it.
	// So the trigger is identified by OUTCOME instead: click the candidates until
	// the settings panel expands (see MessageButton.po).
	// `:not(.show-large-down)` excludes the narrow-viewport-only extra-actions toggle,
	// which is present in the DOM but hidden at desktop widths — without it the first
	// match is an element that can never be visible.
	toggleActionCss: 'nb-layout-header nb-action.toggle-layout:not(.show-large-down)',
	// Assert against the EXPANDED panel: `ngx-theme-settings` is always in the DOM
	// (the sidebar is merely collapsed), so keying off the component alone would
	// pass without the panel ever having opened.
	panelCss: 'nb-sidebar.settings-sidebar.expanded ngx-theme-settings',
	supportLinksCss: 'nb-sidebar.settings-sidebar.expanded ngx-theme-settings .support-links'
};
