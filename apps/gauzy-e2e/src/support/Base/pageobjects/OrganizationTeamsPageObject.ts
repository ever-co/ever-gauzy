export const OrganizationTeamsPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar "Add" lives inside ngx-gauzy-button-action's visible-button template.
	addTeamButtonCss: 'ngx-gauzy-button-action button[status="success"]:has-text("Add")',
	// Team mutation form is a flat dialog (ga-teams-mutation): name input is placeholder-based now.
	// Scope to the dialog (.editable) so a lingering closed-dialog overlay can't trip strict-mode.
	teamNameInputCss: '.editable [placeholder="Team Name"]',
	// Tags is a ga-tags-color-input -> ng-select#addTags (appendTo=body). Opens on MOUSEDOWN, so it is
	// opened via keyboard in the wrapper, not clicked.
	// SCOPE TO THE DIALOG (.editable): the Teams GRID also renders a ga-tags-color-input (its Tags column
	// filter, TagsColorFilterComponent) -> a SECOND ng-select#addTags. A bare '#addTags' matched the grid
	// filter's one first (.first() = earlier in DOM), so the spec focused/opened the GRID filter, selected a
	// tag there (the "Default" filter chip seen in the failure DOM), reloaded the grid, and the dialog's
	// nb-dialog (closeOnBackdropClick:true) closed — so the later member nb-select was never found.
	tagsSelectCss: '.editable #addTags',
	tagsSelectOptionCss: 'div.ng-option',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Neutral, dialog-internal click target to dismiss an open ng-select panel without closing the
	// nb-dialog itself (Escape would close the whole dialog; the page nb-card-body sits behind a backdrop).
	cardBodyCss: '.editable h5.title',
	// Members/Managers are ga-employee-multi-select -> nb-select. Scope inside the dialog (.editable) and by
	// the component's stable <label> text (FORM.LABELS.* — "Add or Remove Members"/"Add or Remove Managers"),
	// NOT the nb-select's placeholder: in EDIT mode the team is pre-populated, so the nb-select shows the
	// selected employees' (text-less avatar) chips instead of the placeholder, and a placeholder match would
	// no longer find it. The label persists regardless of selection. The nb-select itself is rendered only
	// once the component's @if (loaded) flips true (after its working-employees load), so the click wrappers
	// wait for it to attach.
	employeeMultiSelectCss: '.editable ga-employee-multi-select:has-text("Add or Remove Members") nb-select',
	managerMultiSelectCss: '.editable ga-employee-multi-select:has-text("Add or Remove Managers") nb-select',
	selectDropdownOptionCss: '.option-list nb-option',
	saveButtonCss: 'button[status="success"]:has-text("Save")',
	editButtonCss: 'button.action.primary',
	deleteButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyTeamCss: 'angular2-smart-table tbody'
};
