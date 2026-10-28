export const OrganizationVendorsPage = {
	gridButtonCss: 'div.layout-switch > button',
	addVendorButtonCss: 'button[status="success"]:has-text("Add")',
	selectItemCss: 'nb-card-body.custom-table div.row',
	// One vendor row (the clickable card body that selects it), filtered by the vendor's name.
	vendorRowCss: 'nb-card-body.custom-table',
	nameInputCss: '[formcontrolname="name"]',
	phoneInputCss: '[formcontrolname="phone"]',
	emailInputCss: '[formcontrolname="email"]',
	websiteInputCss: '[formcontrolname="website"]',
	addTagsDropdownCss: '#addTags',
	tagsDropdownOption: 'div.ng-option',
	saveVendorButtonCss: 'button[status="success"]:has-text("Save")',
	editVendorButtonCss: 'button.action.primary',
	deleteVendorButtonCss: 'button.action:has(nb-icon[icon="trash-2-outline"])',
	confirmDeleteButtonCss: 'nb-card-footer > button[status="danger"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// The row's NAME cell. Was `div.float-left.text-truncate`: c53db3d7c0 (#10160, "polish organizations
	// pages 2") dropped `float-left` from all five cells (a float on a flex item is ignored) and gave the
	// name cell its own `ga-name-cell` class (vendors.component.html), so the old selector matched nothing
	// even though the saved vendor was on screen (stage run 40364004456 screenshot).
	verifyVendorCss: 'nb-card-body.custom-table div.ga-name-cell'
};
