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
	selectEquipmentDropdownCss: 'ngx-equipment-sharing-mutation [formcontrolname="equipment"]',
	selectEquipmentDropdownOptionCss: '.option-list nb-option',
	selectPolicyDropdownCss: 'ngx-equipment-sharing-mutation [formcontrolname="equipmentSharingPolicyId"]',
	selectPolicyDropdownOptionCss: '.option-list nb-option',
	dateInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="shareRequestDay"]',
	startDateInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="shareStartDay"]',
	endDateInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="shareEndDay"]',
	// Request (equipment-sharing) dialog name input — same formcontrolname="name", different host.
	requestNameInputCss: 'ngx-equipment-sharing-mutation [formcontrolname="name"]',
	// Policy (equipment-sharing-policy) dialog inputs.
	policyNameInputCss: 'ngx-equipment-sharing-policy-mutation [formcontrolname="name"]',
	policyDescriptionInputCss: 'ngx-equipment-sharing-policy-mutation [formcontrolname="description"]',
	equipmentSharingPolicyButtonCss: 'button.action[status="primary"]',
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
