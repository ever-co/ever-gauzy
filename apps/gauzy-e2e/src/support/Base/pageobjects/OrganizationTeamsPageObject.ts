export const OrganizationTeamsPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar "Add" lives inside ngx-gauzy-button-action's visible-button template.
	addTeamButtonCss: 'ngx-gauzy-button-action button[status="success"]:has-text("Add")',
	// Team mutation form is a flat dialog (ga-teams-mutation): name input is placeholder-based now.
	// Scope to the dialog (.editable) so a lingering closed-dialog overlay can't trip strict-mode.
	teamNameInputCss: '.editable [placeholder="Team Name"]',
	// Tags is a ga-tags-color-input -> ng-select#addTags (appendTo=body). Opens on MOUSEDOWN, so it is
	// opened via keyboard in the wrapper, not clicked.
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: 'div.ng-option',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Neutral, dialog-internal click target to dismiss an open ng-select panel without closing the
	// nb-dialog itself (Escape would close the whole dialog; the page nb-card-body sits behind a backdrop).
	cardBodyCss: '.editable h5.title',
	// Members/Managers are ga-employee-multi-select -> nb-select; identify each by its placeholder text.
	employeeMultiSelectCss: 'nb-select:has-text("Add or Remove Team Members")',
	managerMultiSelectCss: 'nb-select:has-text("Add or Remove Team Managers")',
	selectDropdownOptionCss: '.option-list nb-option',
	saveButtonCss: 'button[status="success"]:has-text("Save")',
	editButtonCss: 'button.action.primary',
	deleteButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyTeamCss: 'angular2-smart-table tbody'
};
