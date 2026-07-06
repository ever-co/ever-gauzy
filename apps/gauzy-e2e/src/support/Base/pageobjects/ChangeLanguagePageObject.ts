export const ChangeLanguage = {
	// Header settings gear ("Quick Settings" sidebar toggle). Registered LAST of the two
	// `nb-action.toggle-layout` sidebar actions (changelog gift-outline, then settings
	// settings-2-outline) in default-sidebars.ts, so `:last-of-type` targets the settings gear.
	settingsButtonCss: 'nb-action.toggle-layout:last-of-type',
	// The Quick Settings sidebar host — carries `collapsed` while hidden / `expanded` once open
	// (settings_sidebar class in default-sidebars.ts). Used to detect open/closed state, because
	// selecting a language auto-collapses the panel and it must be re-opened each round.
	settingsSidebarCss: 'nb-sidebar.settings-sidebar',
	// The language nb-select lives inside ngx-theme-language-selector (theme-language-selector.component.html):
	//   <nb-select ... (selectedChange)="switchLanguage()"> ... <nb-option [value]="lang.value">EN (English)</nb-option>
	languageDropdownCss: 'ngx-theme-language-selector nb-select',
	// The nb-select's clickable trigger renders as `button.select-button` (Nebular). Click THIS to
	// open the option panel (clicking the wrapper host can no-op). Mirrors the verified-green
	// SettingsButton.dropdownButtonCss.
	languageSelectButtonCss: 'ngx-theme-language-selector nb-select button.select-button',
	// Opened nb-select renders its options into a cdk overlay as `.option-list nb-option`. Each option
	// text is `{{ lang.value | uppercase }} ({{ lang.name | translate }})` -> e.g. "EN (English)",
	// "BG (Български)". The stale `ul.option-list > nb-option` chain can miss the actual overlay DOM;
	// mirrors the verified-green SettingsButton.dropdownOptionCss.
	languageOptionsCss: '.option-list nb-option',
	// Header "+ Create" button (header.component.html: `<button ... class="button create" status="warning">
	// + {{ 'BUTTONS.CREATE' | translate }}`). Its label is translated, so it reflects the active language
	// ("+ Create" / "+ Създайте" / "+ Создать" / "+ צור") — the flow's language-changed assertion target.
	// Replaces the stale `nb-action.show-large-up > button[status="warning"]` chain (button.create is the
	// same element the migrated Dashboard/CreateButton objects target).
	createButtonCss: 'button.create'
};
