export const RolesPermissionsPage = {
	cardBodyCss: 'div.col-xl-6 > nb-card',
	nbToggleCss: 'div.col-xl-6 > nb-card > nb-card-body > nb-toggle',
	// Scope checkboxes to the permission toggles only. Bare `input.native-input` also matches the
	// header Light/Dark theme switch (gauzy-switch-theme) and any other nb-toggle on the page, which
	// renders BEFORE the permission cards — so index 0 pointed at the theme switch, not the first
	// permission. The permission toggles live inside nb-card-body.permission-items-col.
	checkboxCss: 'nb-card-body.permission-items-col input.native-input',
	// The screen renders TWO permission cards in document order: GENERAL first, ADMINISTRATION second
	// (roles-permissions.component.html). The flat checkboxCss spans both; verifyState used a single
	// running index across the concatenation, but the permission catalog (PermissionGroups.GENERAL /
	// .ADMINISTRATION in @gauzy/contracts) has grown/reordered far past the old fixed 0..84 map, so a
	// global index no longer maps to a stable permission. The wrapper scopes per card body (the
	// container below, nth(0)=GENERAL, nth(1)=ADMINISTRATION) and indexes the inputs WITHIN that card,
	// so the assertions track the live GENERAL- then ADMINISTRATION-ordered toggle lists independently.
	cardBodyContainerCss: 'nb-card-body.permission-items-col',
	cardInputCss: 'input.native-input',
	textCss: '.custom-permission-view strong',
	rolesDropdownCss: 'input[placeholder="Select Role"]',
	// The role selector is now an nbAutocomplete (not nb-select); its options still render in a
	// .option-list as <nb-option>, but the visible text is the RAW role enum value (SUPER_ADMIN,
	// DATA_ENTRY, ...) — not the friendly label. selectRoleFromDropdown normalises the label to the
	// enum form before filtering.
	dropdownOptionCss: '.option-list nb-option'
};
