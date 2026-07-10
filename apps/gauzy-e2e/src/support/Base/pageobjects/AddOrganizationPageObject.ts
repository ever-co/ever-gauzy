export const AddOrganizationPage = {
	// Add lives in the list toolbar (#visible template): `button[status="success"]` with a plus icon.
	// Scope to the icon so a leaked success button elsewhere can't be matched first.
	addButtonCss: 'button[status="success"]:has(nb-icon[icon="plus-outline"])',
	// Step-1 main form (organizations-step-form): name input is id="nameInput" / placeholder "Organization Name".
	organizationNameFieldCss: 'input[id="nameInput"]',
	// Currency + country are <ng-select> (ga-currency / ga-country, appendTo="body") — open via the
	// host element's DOM (openNgSelect) and pick from the body-level ng-dropdown-panel.
	currencyFieldCss: 'ga-currency ng-select',
	countryDropdownCss: 'ga-country ng-select',
	// ng-select options render in the body-level dropdown panel.
	dropdownOptionCss: 'ng-dropdown-panel .ng-option',
	// nb-select option lists render in a cdk overlay as nb-option.
	nbOptionCss: '.option-list nb-option',
	officialNameFieldCss: 'input[id="officialNameInput"]',
	taxFieldCss: 'input[id="taxIdInput"]',
	// Stepper Next buttons (nbStepperNext) carry the localized "Next" label; the final step's
	// confirm is a status="success" "Add" button. Both are driven by clickFormButtonByText in the .po.
	nextButtonCss: 'button:has-text("Next")',
	addOrgButtonCss: 'button[status="success"]:has-text("Add")',
	verifyOrganizationCss: 'angular2-smart-table',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// Step-2 location form (ga-location-form) text inputs.
	cityInputCss: 'input[id="cityInput"]',
	postCodeInputCss: 'input[id="postcodeInput"]',
	streetInputCss: 'input[id="addressInput"]',
	// Step-3 bonus form: nb-select + number input (scoped by formcontrolname).
	bonusTypeDropdownCss: 'nb-select[formcontrolname="bonusType"], [formcontrolname="bonusType"]',
	bonusPercentageCss: 'input[formcontrolname="bonusPercentage"]',
	// Step-4 settings form.
	expiryPeriodInputCss: 'input[formcontrolname="inviteExpiryPeriod"]',
	dateTypeDropdownCss: 'nb-select[formcontrolname="defaultValueDateType"], [formcontrolname="defaultValueDateType"]',
	startOfWeekDropdownCss: 'nb-select[id="startWeekOnSelect"], #startWeekOnSelect',
	regionCodeDropdownCss: 'nb-select[formcontrolname="regionCode"], [formcontrolname="regionCode"]',
	numberFormatDropdownCss: 'nb-select[formcontrolname="numberFormat"], [formcontrolname="numberFormat"]',
	dateFormatDropdownCss: 'nb-select[formcontrolname="dateFormat"], [formcontrolname="dateFormat"]',
	// timeZone is a <ng-select> (ga-timezone-selector, appendTo="body").
	timeZoneDropdownCss: 'ga-timezone-selector ng-select, #timeZone',
	timeZoneDropdownOptionCss: 'ng-dropdown-panel .ng-option',
	tableRowCss: 'table > tbody > tr.angular2-smart-row'
};
