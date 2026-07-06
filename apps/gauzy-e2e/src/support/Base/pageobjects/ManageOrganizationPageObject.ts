export const ManageOrganizationPage = {
	gridButtonCss: 'div.layout-switch > button',
	// Toolbar "Manage" button (organizations.component.html #actionButtons) — opens the edit form.
	manageButtonCss: 'button.action.primary',
	// edit-organization-settings renders an nb-route-tabset → ul.route-tabset > li > a.tab-link.
	tabButtonCss: 'ul.route-tabset > li > a.tab-link',
	languageDropdownCss: '#lang',
	// nb-select option lists render in a cdk overlay as nb-option.
	dropdownOptionCss: '.option-list nb-option',
	nameInputCss: '#nameInput',
	codeInputCss: '#codeInput',
	selectTableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Save button on each settings tab: `div.actions > button[status="success"]`.
	saveButtonCss: 'div.actions > button[status="success"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// Main tab (edit-organization-main): name is id="nameInput".
	organizationNameFieldCss: '#nameInput',
	// Currency + country are <ng-select> (ga-currency / ga-country, appendTo="body") — open via the
	// host element's DOM (openDropdown) and pick from the body-level ng-dropdown-panel.
	currencyFieldCss: 'ga-currency ng-select',
	officialNameFieldCss: '#officialNameInput',
	taxFieldCss: '#taxIdInput',
	verifyOrganizationCss: 'angular2-smart-table',
	countryDropdownCss: 'ga-country ng-select',
	// Location tab (ga-location-form) text inputs.
	cityInputCss: '#cityInput',
	postCodeInputCss: '#postcodeInput',
	streetInputCss: '#addressInput',
	// Settings tab (edit-organization-other-settings). bonus/expiry live in the Bonus/Invite
	// accordions — not driven by this spec but kept for parity. nb-selects are matched on the host.
	bonusTypeDropdownCss: 'nb-select[formcontrolname="bonusType"], [formcontrolname="bonusType"]',
	bonusPercentageCss: 'input[formcontrolname="bonusPercentage"]',
	expiryPeriodInputCss: 'input[formcontrolname="inviteExpiryPeriod"]',
	dateTypeDropdownCss: 'nb-select[formcontrolname="defaultValueDateType"], [formcontrolname="defaultValueDateType"]',
	startOfWeekDropdownCss: 'nb-select[id="startWeekOnSelect"], #startWeekOnSelect',
	regionCodeDropdownCss: 'nb-select[formcontrolname="regionCode"], [formcontrolname="regionCode"]',
	numberFormatDropdownCss: 'nb-select[formcontrolname="numberFormat"], [formcontrolname="numberFormat"]',
	dateFormatDropdownCss: 'nb-select[formcontrolname="dateFormat"], [formcontrolname="dateFormat"]',
	// timeZone is a <ng-select> (ga-timezone-selector, appendTo="body").
	timeZoneDropdownCss: 'ga-timezone-selector ng-select, #timeZone',
	timeZoneDropdownOptionCss: 'ng-dropdown-panel .ng-option',
	tableRowCss: 'table > tbody > tr.angular2-smart-row',
	cardBodyCss: 'nb-layout-column.ng-star-inserted'
};
