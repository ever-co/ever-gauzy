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
	// ga-organizations-step-form — the Add Organization dialog AND the onboarding page (Register) render it.
	// Since #10608 (ffc762ee8a) the step actions are no longer inside nb-stepper: the card footer
	// (nb-card-footer.dialog-footer) holds Back / Cancel (ghost, status="basic") and ONE primary action —
	// "Continue" (or "Skip" on a blank location step) and "Create organization" on the last step — gated by
	// [disabled]="!canContinue(stepper.selectedIndex)".
	stepFormCss: 'ga-organizations-step-form',
	stepFormPrimaryButtonCss: 'ga-organizations-step-form nb-card-footer.dialog-footer button[status="primary"]',
	// The step indicator in the card header: one div.step per step (4 in the dialog, 5 when onboarding), each
	// step before the current one marked `.done` — so the number of `.done` steps IS stepper.selectedIndex.
	stepIndicatorCss: 'ga-organizations-step-form nav.steps div.step',
	stepIndicatorDoneCss: 'ga-organizations-step-form nav.steps div.step.done',
	verifyOrganizationCss: 'angular2-smart-table',
	// Name-column filter of the organizations grid (column key `name`, organizations.component.ts).
	nameFilterInputCss: 'th.angular2-smart-th.name input',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// Step-2 location form (ga-location-form) text inputs.
	cityInputCss: 'input[id="cityInput"]',
	postCodeInputCss: 'input[id="postcodeInput"]',
	streetInputCss: 'input[id="addressInput"]',
	// Step-3 bonus form: nb-select (id="bonusTypeSelect") + number input (scoped by formcontrolname).
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
