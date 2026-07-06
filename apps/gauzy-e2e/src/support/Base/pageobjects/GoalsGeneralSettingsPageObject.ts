export const GoalsGeneralSettingsPage = {
	headerTextCss: 'nb-card-header.card-header-title h4',
	subheaderTextCss: 'div.col-md-4 > p.font-weight-bold',
	// Scope toggle/checkbox selectors to the goal-settings component. The app shell renders ~50 other
	// nb-toggle/nb-checkbox native inputs (sidebar, theme switcher, layout), so the unscoped
	// 'div.toggle' / 'input.native-input' matched 51 elements and nth(0..2) landed on unrelated,
	// unchecked controls — making verifyCheckboxState(*, checked) fail. Within ga-goal-settings there
	// are exactly the 3 form toggles (employeeCanCreateObjective, krTypeKPI, krTypeTask) at idx 0/1/2.
	nbToggleCss: 'ga-goal-settings nb-toggle div.toggle',
	checkboxCss: 'ga-goal-settings nb-toggle input.native-input',
	goalsInpuCss: '#max-goals',
	keyResultInputCss: '#max-key-result',
	objectivesDropdownCss: '[formcontrolname="canOwnObjectives"]',
	keyResultDropdownCss: '[formcontrolname="canOwnKeyResult"]',
	optionDropdownCss: '.option-list nb-option',
	toastrMessageCss: 'nb-toast.ng-trigger'
};
