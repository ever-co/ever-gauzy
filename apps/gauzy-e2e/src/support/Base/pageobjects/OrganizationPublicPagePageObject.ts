export const OrganizationPublicPage = {
	organizationDropdownCss: 'ga-organization-selector ng-select',
	organizationDropdownOptionsCss: 'ng-dropdown-panel > div.ng-dropdown-panel-items div.ng-option',
	// The organizations grid reuses the "Client Name" column header/filter label (SM_TABLE.CLIENT_NAME),
	// so the name-filter input placeholder really is "Client Name" here — verified against
	// organizations.component.ts columns.name.title.
	nameFilterInputCss: 'input[placeholder="Client Name"]',
	organizationTableRowCss: 'table > tbody > tr.angular2-smart-row:first-of-type',
	// The name cell renders via OrganizationWithTagsComponent as `.organization-render span > div`
	// (no more `div.d-block`); match the render container's text so the filter-result assertion holds.
	organizationNameTableCellCss: 'table > tbody > tr.angular2-smart-row:first-of-type .organization-render',
	manageButtonCss: 'button.action.primary',
	profileLinkInputCss: 'input[formcontrolname="profile_link"]',
	saveButtonCss: 'div.actions > button[status="success"]',
	toastrMessageCss: 'nb-toast.ng-trigger',
	editPageButtonCss: 'header.profile-header div.actions > button',
	companyNameInputCss: 'input[formcontrolname="name"]',
	companySizeInputCss: 'input[formcontrolname="totalEmployees"]',
	yearFoundedInputCss: 'input[formcontrolname="founded"]',
	bannerInputCss: 'input[formcontrolname="banner"]',
	minimumProjectSizeDropdownCss: '#minimumProjectSize > button',
	minimumProjectSizeDropdownOptionsCss: 'nb-option-list > ul.option-list > nb-option',
	clientFocusDropdownCss: 'ng-select:has(#addClientFocus) > div.ng-select-container',
	clientFocusDropdownOptionsCss: 'ng-dropdown-panel > div.ng-dropdown-panel-items div.ng-option',
	shortDescriptionInputCss: 'textarea[formcontrolname="short_description"]',
	cardBodyCss: 'nb-card-body.dialog-body',
	awardsTabCss: 'nb-card-header.dialog-header button[role="tab"]',
	// The redesigned edit dialog (#11130): tabs are buttons in the dialog header, each pane has an
	// "add" link and an add-row with its own primary Save, scoped by the pane id.
	addAwardsButtonCss: '#org-edit-pane-awards button.add-link',
	awardNameInputCss: '#awardName',
	awardYearInputCss: '#awardYear',
	awardsSaveButtonCss: '#org-edit-pane-awards .add-row-actions button[status="primary"]',
	skillsTabCss: 'nb-card-header.dialog-header button[role="tab"]',
	skillsDropdownCss: 'ng-select[formcontrolname="skills"]',
	skillsDropdownOptionsCss: 'ng-dropdown-panel > div.ng-dropdown-panel-items div.ng-option',
	languagesTabCss: 'nb-card-header.dialog-header button[role="tab"]',
	addLanguageButtonCss: '#org-edit-pane-languages button.add-link',
	// ngx-language-selector [template]="'ng-select'" renders an <ng-select class="language-select">. In
	// ng-select 24 role="combobox" sits on the inner <input>, not on a div, so the old
	// `div[role="combobox"]` matched nothing.
	languageDropdownCss: 'ngx-language-selector ng-select',
	languageDropdownOptionsCss: 'ng-dropdown-panel > div.ng-dropdown-panel-items div.ng-option',
	languageLevelDropdownCss: 'nb-select#languageLevel',
	languageLevelDropdownOptionsCss: 'nb-option-list > ul.option-list > nb-option',
	languageSaveButtonCss: '#org-edit-pane-languages .add-row-actions button[status="primary"]',
	updateButtonCss: 'nb-card-footer.dialog-footer > button[status="primary"]',
	companyNameCss: 'header.profile-header h1.name',
	bannerCss: 'header.profile-header p.banner',
	companySizeCss: 'header.profile-header dl.facts div.fact',
	totalClientsCss: 'header.profile-header dl.facts div.fact',
	clientFocusCss: 'ul.focus li.focus-item',
	skillsCss: 'ul.chips li.chip',

	organizationNameFieldCss: '[placeholder="Organization Name"]',
	currencyFieldCss: '#currencySelect',
	dropdownOptionCss: '.option-list nb-option',
	officialNameFieldCss: '#officialNameInput',
	gridButtonCss: 'div.layout-switch > button',
	taxFieldCss: '#taxIdInput',
	// The step form's actions moved to its card footer in #10608 (ffc762ee8a) — there is no submit button.
	// The .po drives steps 2-4 and this button through AddOrganization.po (advanceStepForm).
	nextButtonCss: 'ga-organizations-step-form nb-card-footer.dialog-footer button[status="primary"]',
	// Add button moved from nb-card-body into the nb-card-header toolbar (ngx-gauzy-button-action
	// #visible template). Scope to the plus icon so a leaked success button elsewhere can't match first.
	addButtonCss: 'button[status="success"]:has(nb-icon[icon="plus-outline"])',
	verifyOrganizationCss: 'div.d-block',
	// <ga-country> renders an ng-select (appendTo="body"), not an nb-select — mirrors
	// AddOrganizationPageObject, which was migrated when the control changed while this copy was not.
	countryDropdownCss: 'ga-country ng-select',
	// ...and its options therefore live in the body-level ng-dropdown-panel, not in an nb-option list.
	// The shared dropdownOptionCss above stays '.option-list nb-option' because the bonus-type /
	// start-of-week / date-type / region / number-format / date-format controls really are nb-selects.
	countryDropdownOptionCss: 'ng-dropdown-panel .ng-option',
	cityInputCss: '#cityInput',
	postCodeInputCss: '#postcodeInput',
	streetInputCss: '#addressInput',
	bonusTypeDropdownCss: '[formcontrolname="bonusType"]',
	bonusPercentageCss: '[formcontrolname="bonusPercentage"]',
	expiryPeriodInputCss: '[formcontrolname="inviteExpiryPeriod"]',
	dateTypeDropdownCss: '[formcontrolname="defaultValueDateType"]',
	startOfWeekDropdownCss: '#startWeekOnSelect',
	regionCodeDropdownCss: '[formcontrolname="regionCode"]',
	numberFormatDropdownCss: '[formcontrolname="numberFormat"]',
	dateFormatDropdownCss: '[formcontrolname="dateFormat"]',
	timeZoneDropdownCss: '[formcontrolname="timeZone"]',
	timeZoneDropdownOptionCss: 'div.ng-option',
	tableRowCss: 'table > tbody > tr.angular2-smart-row'
};
