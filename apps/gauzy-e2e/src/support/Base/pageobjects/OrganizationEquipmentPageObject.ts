export const OrganizationEquipmentPage = {
	gridButtonCss: 'div.layout-switch > button',
	addButtonCss: 'button[status="success"]:has-text("Add")',
	// The three equipment dialogs (equipment / sharing-request / sharing-policy) all expose a
	// formcontrolname="name" input, and the preceding addTag step can leave its own
	// ngx-tags-mutation dialog (also formcontrolname="name") mounted. Scope each form field to its
	// OWN mutation host so an unscoped .first() never matches a leftover/wrong dialog.
	nameInputCss: 'ngx-equipment-mutation [formcontrolname="name"]',
	typeInputCss: 'ngx-equipment-mutation [formcontrolname="type"]',
	serialNumberInputCss: 'ngx-equipment-mutation [formcontrolname="serialNumber"]',
	manufacturedYearInputCss: 'ngx-equipment-mutation [formcontrolname="manufacturedYear"]',
	initialCostInputCss: 'ngx-equipment-mutation [formcontrolname="initialCost"]',
	maxSharePeriodInputCss: 'ngx-equipment-mutation [formcontrolname="maxSharePeriod"]',
	// Equipment tags = ga-tags-color-input ng-select (#addTags). Opens on mousedown and is
	// backdrop-blocked; the .po wrapper opens it via keyboard, not a click.
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	saveButtonCss: 'nb-card-footer button[status="success"]',
	editEquipmentButtonCss: 'button.action.primary',
	deleteEquipmentButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	footerCss: 'nb-card-footer',
	equipmentSharingButtonCss: 'button.sharing[status="primary"]',
	// Routes used by the cross-page navigation in this flow — waited on after each nav click so the
	// next step never races against a still-pending route change (see the .po wrappers).
	equipmentRoute: '**/pages/organization/equipment',
	equipmentSharingRoute: '**/pages/organization/equipment-sharing',
	equipmentSharingPolicyRoute: '**/pages/organization/equipment-sharing-policy',
	selectEquipmentDropdownCss: 'ngx-equipment-sharing-mutation [formcontrolname="equipment"]',
	selectEquipmentDropdownOptionCss: '.option-list nb-option',
	selectPolicyDropdownCss: 'ngx-equipment-sharing-mutation [formcontrolname="equipmentSharingPolicyId"]',
	selectPolicyDropdownOptionCss: '.option-list nb-option',
	// Employees field in the request dialog = ga-employee-multi-select wrapping an nb-select. Click the
	// inner nb-select to open; its options render in the cdk overlay as .option-list nb-option. The list
	// is the org's employees "working" in the header date range (async, can be empty) — the .po wrapper
	// treats selection as best-effort (employees is NOT a required field on the request form).
	selectEmployeeDropdownCss: 'ga-employee-multi-select nb-select',
	selectEmployeeDropdownOptionCss: '.option-list nb-option',
	dateInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="shareRequestDay"]',
	startDateInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="shareStartDay"]',
	endDateInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="shareEndDay"]',
	// Request (equipment-sharing) dialog name input — same formcontrolname="name", different host.
	requestNameInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="name"]',
	// Policy (equipment-sharing-policy) dialog inputs.
	policyNameInputCss: 'ngx-equipment-sharing-policy-mutation [formcontrolname="name"]',
	policyDescriptionInputCss: 'ngx-equipment-sharing-policy-mutation [formcontrolname="description"]',
	// The equipment-sharing page's "Equipment Sharing Policy" nav button is button.action[status="primary"]
	// WITHOUT the .sharing class. The equipment page's "Equipment Sharing" header button is
	// button.action.sharing[status="primary"] — exclude .sharing so this never matches the wrong page's
	// button when a route change is still mid-flight (that ambiguity opened the wrong dialog).
	equipmentSharingPolicyButtonCss: 'button.action[status="primary"]:not(.sharing)',
	backButtonCss: 'ngx-back-navigation button[status="primary"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	verifyPolicyCss: 'tr.angular2-smart-row',
	verifySharingCss: 'angular2-smart-table',
	verifyEquipmentCss: 'ga-picture-name-tags',
	spinnerCss: 'nb-spinner',
	// Leftover tags dialog host — used by the defensive "dismiss any open dialog" guard before
	// opening a new add form (its modal backdrop otherwise blocks the equipment Add button).
	tagsMutationCss: 'ngx-tags-mutation'
};
