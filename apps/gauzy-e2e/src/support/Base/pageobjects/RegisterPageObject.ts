export const RegisterPage = {
	// --- Register form (ngx-register / register.component) ---
	// Login page link to the register screen renders routerLink="/auth/register" => href*="register".
	registerLinkCss: 'a.text-link[href*="register"]',
	fullNameFieldCss: '#input-name',
	emailAddressFieldCss: '#input-email',
	passwordFieldCss: '#input-password',
	confirmPassFieldCss: '#input-re-password',
	// nb-checkbox renders its visual box as span.custom-checkbox (the terms checkbox).
	termAndConditionCheckboxCss: 'span.custom-checkbox',
	registerButtonCss: 'ngx-register form button.submit-btn',

	// --- First-organization onboarding stepper (organizations-step-form, isOnboarding=true) ---
	// This is the SAME component driven by AddOrganizationTest; selectors mirror its proven values.
	organizationNameFieldCss: 'input[id="nameInput"]',
	// currency + country are <ng-select> (ga-currency / ga-country, appendTo="body").
	currencyFieldCss: 'ga-currency ng-select',
	// ng-select options render in the body-level dropdown panel; nb-select options in a cdk overlay.
	// clickOptionByText (in the .po) searches across both, so this combined list is used everywhere.
	dropdownOptionCss: 'ng-dropdown-panel .ng-option, div.ng-option, .option-list nb-option, .cdk-overlay-container nb-option',
	officialNameFieldCss: 'input[id="officialNameInput"]',
	taxFieldCss: 'input[id="taxIdInput"]',
	// Stepper forward button (nbStepperNext) carries the localized "Next" label; the final employee
	// step's confirm is a status="success" "Add" button — both driven by text in the .po.
	nextButtonCss: 'button:has-text("Next")',
	// Employee (step 5) submit button — completes onboarding in isOnboarding mode.
	finishButtonCss: 'button[status="success"]:has-text("Add")',
	verifyOrganizationCss: 'div.d-block',
	toastrMessageCss: 'nb-toast.ng-trigger',
	// country is a <ng-select> inside ga-country (location form, step 2).
	countryDropdownCss: 'ga-country ng-select',
	cityInputCss: 'input[id="cityInput"]',
	postCodeInputCss: 'input[id="postcodeInput"]',
	streetInputCss: 'input[id="addressInput"]',
	// Step-3 bonus form: nb-select + number input (scoped by formcontrolname).
	bonusTypeDropdownCss: 'nb-select[formcontrolname="bonusType"], [formcontrolname="bonusType"]',
	bonusPercentageCss: 'input[formcontrolname="bonusPercentage"]',
	expiryPeriodInputCss: 'input[formcontrolname="inviteExpiryPeriod"]',
	// Step-4 settings form (nb-selects scoped by formcontrolname / id).
	dateTypeDropdownCss: 'nb-select[formcontrolname="defaultValueDateType"], [formcontrolname="defaultValueDateType"]',
	startOfWeekDropdownCss: 'nb-select[id="startWeekOnSelect"], #startWeekOnSelect',
	regionCodeDropdownCss: 'nb-select[formcontrolname="regionCode"], [formcontrolname="regionCode"]',
	numberFormatDropdownCss: 'nb-select[formcontrolname="numberFormat"], [formcontrolname="numberFormat"]',
	dateFormatDropdownCss: 'nb-select[formcontrolname="dateFormat"], [formcontrolname="dateFormat"]',
	// timeZone is a <ng-select> (ga-timezone-selector, appendTo="body", host id="timeZone").
	timeZoneDropdownCss: 'ga-timezone-selector ng-select, #timeZone',
	timeZoneDropdownOptionCss: 'ng-dropdown-panel .ng-option, div.ng-option',
	tableRowCss: 'table > tbody > tr.angular2-smart-row',
	// Authenticated app shell logo (one-column layout) — proves login succeeded.
	verifyLogoCss: 'div.logo-container'
};
