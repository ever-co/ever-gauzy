export const EditUserPage = {
	gridButtonCss: 'div.layout-switch > button',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Full Name column filter input in the users smart-table header (tr.angular2-smart-filters). The
	// shared serial DB accumulates users (seed admin + every faker user/employee earlier specs create),
	// so the grid paginates at 10 and the user this spec just added lands on page 2 — not rendered, so
	// neither the by-name verify nor the row click can find it. Same column key as RemoveUserPageObject.
	nameFilterInputCss: 'th.angular2-smart-th.fullName input',
	editButtonCss: 'button:has(nb-icon[icon="edit-outline"])',
	orgTabButtonCss: 'ul.route-tabset > li > a.tab-link',
	// Organizations tab (edit-user-organizations): the header's "Add to organization" opens the inline add form;
	// each organization row has its own remove button.
	addOrgButtonCss: 'button.orgs__add-toggle',
	removeOrgButtonCss: 'button.orgs__remove',
	confirmRemoveOrgButtonCss: 'nb-card-footer > button[status="danger"]',
	// "Add to organization" opens the add dialog (in the overlay): a search (#addOrganizationsSearch) over a
	// checklist of `button.assign-option` rows, with Cancel and Add in its footer. Cancel closes the dialog when
	// there is nothing to add.
	selectOrgMultiSelectCss: '#addOrganizationsSearch',
	selectOrgDropdownOptionCss: '.assign-dialog button.assign-option',
	saveSelectedOrgButton: '.assign-dialog button.assign-dialog__submit',
	cancelAddOrgButtonCss: '.assign-dialog__actions > button[status="basic"]',
	firstNameInputCss: '#firstName',
	lastNameInputCss: '#lastName',
	// Password fields are ngx-password-form-field; the rendered input carries the translated
	// placeholder. reset-password is the repeat field's id (matches the edit-profile-form markup).
	passwordInputCss: '[placeholder="Password"]',
	repeatPasswordInputCss: '[placeholder="Repeat Password"]',
	emailInputCss: '#email',
	tagsSelectCss: '#addTags',
	// The OPTIONS, not the scroll host: 'div.ng-dropdown-panel-items.scroll-host' is the panel's scroll
	// container, so nth(i) addressed the container itself and the pick relied on the coordinate click
	// happening to land on an option. ':not(.ng-option-disabled)' is applied by the shared driver.
	tagsSelectOptionCss: 'div.ng-option',
	roleSelectCss: 'nb-select#role>button',
	// Options render as nb-option inside the cdk-overlay ul.option-list; filter-by-text needs the
	// individual options, not the whole list (the bare .option-list contains every role name).
	roleSelectOptionCss: '.option-list nb-option',
	// Preferred language is an ngx-language-selector ng-select; options are div.ng-option — which is
	// what the comment always claimed, but the selector below used to demand a
	// `> span.ng-option-label` child as well. ng-select only emits that default label span when NO
	// custom option template is supplied, and #9975 added an `<ng-template ng-option-tmp>` (flag icon
	// + language name) to language-selector.component.html, so the span disappeared and the option
	// text is now rendered directly inside div.ng-option. Scoped to the open dropdown panel because
	// the control is appendTo="body".
	preferredLanguageCss: 'ngx-language-selector ng-select',
	preferredLanguageOptionCss: 'ng-dropdown-panel div.ng-option',
	// Scope the submit button to the profile form's footer so it can't match the org tab's buttons.
	saveButtonCss: 'footer.profile__actions > button[status="success"]',
	verifyUserCss: 'div.names-wrapper',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
