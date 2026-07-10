export const OrganizationDepartmentsPage = {
	gridButtonCss: 'div.layout-switch > button',
	addDepartmentButtonCss: 'button[status="success"]:has-text("Add")',
	// Scope the name field to the mutation dialog: a just-closed add/edit dialog can briefly linger as a
	// fading cdk-overlay that ALSO has [placeholder="Department name"], which makes the bare selector
	// match 2 elements and trips clearField()/enterInput() (no .first()) on a strict-mode violation.
	nameInputCss: 'ga-departments-mutation [placeholder="Department name"]',
	selectEmployeeDropdownCss: 'ga-departments-mutation ga-employee-multi-select nb-select',
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	// Scope to the mutation dialog: CustomCommands.addTag leaves its own closed #addTags ng-select in the
	// DOM, so the bare id can match the wrong (closed) control. This selects the in-dialog Tags field.
	addTagsDropdownCss: 'ga-departments-mutation #addTags',
	// ng-select options render as div.ng-option in a body-appended panel (matches the rest of the suite).
	tagsDropdownOption: 'div.ng-option',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	saveDepartmentButtonCss: 'button[type="submit"][status="success"]',
	editDepartmentButtonCss: 'button.action.primary',
	deleteDepartmentButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	footerCss: '.editable',
	verifyDepartmentCss:
		'tbody > tr > td > angular2-smart-table-cell > table-cell-view-mode > div > div.ng-star-inserted',
	toastrMessageCss: 'nb-toast.ng-trigger',
	departmentListCss: 'tbody > tr > td > angular2-smart-table-cell > table-cell-view-mode > div > div.ng-star-inserted'
};
