export const EditUserPage = {
	gridButtonCss: 'div.layout-switch > button',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	editButtonCss: 'button:has(nb-icon[icon="edit-outline"])',
	orgTabButtonCss: 'ul.route-tabset > li > a.tab-link',
	addOrgButtonCss: 'nb-card-header > button[status="success"]',
	removeOrgButtonCss: 'nb-action[icon="close"]',
	confirmRemoveOrgButtonCss: 'nb-card-footer > button[status="danger"]',
	// Org picker is an nb-select[multiple] inside ga-user-organizations-multi-select; the old exact
	// class="select-button placeholder" no longer matches (nb-select adds appearance/status classes).
	selectOrgMultiSelectCss: 'ga-user-organizations-multi-select nb-select',
	selectOrgDropdownOptionCss: '.option-list nb-option',
	saveSelectedOrgButton: 'div.form-group > button[status="success"]',
	firstNameInputCss: '#firstName',
	lastNameInputCss: '#lastName',
	// Password fields are ngx-password-form-field; the rendered input carries the translated
	// placeholder. reset-password is the repeat field's id (matches the edit-profile-form markup).
	passwordInputCss: '[placeholder="Password"]',
	repeatPasswordInputCss: '[placeholder="Repeat Password"]',
	emailInputCss: '#email',
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: 'div.ng-dropdown-panel-items.scroll-host',
	roleSelectCss: 'nb-select#role>button',
	// Options render as nb-option inside the cdk-overlay ul.option-list; filter-by-text needs the
	// individual options, not the whole list (the bare .option-list contains every role name).
	roleSelectOptionCss: '.option-list nb-option',
	// Preferred language is an ngx-language-selector ng-select; options are div.ng-option (mirrors
	// the proven EditProfile selectors on the same edit-profile-form).
	preferredLanguageCss: 'ngx-language-selector ng-select',
	preferredLanguageOptionCss: 'div.ng-option > span.ng-option-label',
	// Scope the submit button to the profile form's actions bar so it can't match the org-tab
	// success buttons (Add / Save org) that share status="success".
	saveButtonCss: 'div.actions > button[status="success"]',
	verifyUserCss: 'div.names-wrapper',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
