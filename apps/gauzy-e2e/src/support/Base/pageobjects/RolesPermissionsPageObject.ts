export const RolesPermissionsPage = {
	cardBodyCss: 'div.col-xl-6 > nb-card',
	nbToggleCss: 'div.col-xl-6 > nb-card > nb-card-body > nb-toggle',
	// Scope checkboxes to the permission toggles only. Bare `input.native-input` also matches the
	// header Light/Dark theme switch (gauzy-switch-theme) and any other nb-toggle on the page, which
	// renders BEFORE the permission cards — so index 0 pointed at the theme switch, not the first
	// permission. The permission toggles live inside nb-card-body.permission-items-col.
	checkboxCss: 'nb-card-body.permission-items-col input.native-input',
	textCss: '.custom-permission-view strong',
	rolesDropdownCss: 'input[placeholder="Select Role"]',
	// The role selector is now an nbAutocomplete (not nb-select); its options still render in a
	// .option-list as <nb-option>, but the visible text is the RAW role enum value (SUPER_ADMIN,
	// DATA_ENTRY, ...) — not the friendly label. selectRoleFromDropdown normalises the label to the
	// enum form before filtering.
	dropdownOptionCss: '.option-list nb-option'
};
