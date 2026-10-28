export const OrganizationProjectsPage = {
	gridButtonCss: 'div.layout-switch > button',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	tagsSelectCss: '#addTags',
	tagsSelectOptionCss: '.ng-dropdown-panel .ng-option',
	closeTagsMultiSelectDropdownCss: '.ng-select-container > .ng-arrow-wrapper',
	selectEmployeeMultiSelectCss: 'nb-select:has-text("Add or Remove Employees")',
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	requestNewProjectButtonCss: 'button[status="success"]:has-text("Add")',
	// The project form is the routed create/edit PAGE's <ga-project-mutation> (not a dialog); scope its fields
	// to the component host so nothing else on the page (header, documents panel) can match first.
	projectFormCss: 'ga-project-mutation',
	projectNameInputCss: 'ga-project-mutation #name',
	codeInputCss: 'ga-project-mutation #code',
	budgetInputCss: 'ga-project-mutation [formcontrolname="budget"]',
	projectDescriptionCss: 'ga-project-mutation [formcontrolname="description"]',
	// Since #11177 (954aac863c) the form renders its own ARIA tablist instead of <nb-tabset>:
	// <button role="tab" id="project-form-tab-<id>"> with ids main, description, billing, budget, openSource,
	// sprints, settings, integrations, automation, modules (some only conditionally offered). Address a tab by
	// its id: `${projectFormTabIdPrefix}<id>`.
	tabButtonCss: 'ga-project-mutation [role="tablist"] button[role="tab"]',
	projectFormTabIdPrefix: 'ga-project-mutation button[role="tab"]#project-form-tab-',
	// The form's action bar (#11177): Cancel (status="basic") then Save (status="primary"). Scoped to the form
	// because the app header's "+ Create" button is also nbButton status="primary".
	saveProjectButtonCss: 'ga-project-mutation div.form-footer > button[status="primary"]',
	editProjectButtonCss: 'button.action.primary',
	deleteProjectButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'ga-delete-confirmation nb-card-footer > button[status="danger"]',
	colorInputCss: 'ga-project-mutation [formcontrolname="color"]',
	footerCss: 'nb-card-body > div.form-group',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyProjectCss: 'angular2-smart-table',
	// The Name column's cell renderer (ProjectOrganizationComponent): <div class="project-render">…<div class="name">.
	projectNameCellCss: 'angular2-smart-table .project-render .name'
};
