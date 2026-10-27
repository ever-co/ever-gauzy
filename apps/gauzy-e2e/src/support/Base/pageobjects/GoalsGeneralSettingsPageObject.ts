export const GoalsGeneralSettingsPage = {
	headerTextCss: 'nb-card-header.card-header-title h4',
	// The General tab is a settings list now (label + control per row), not two
	// bootstrap columns of `p.font-weight-bold` blocks (#10227, 33d464dba1): only the
	// "Max Number of entities" group heading is an `h6.settings-title`; every other
	// setting caption ("Employees can create their own objectives", "Who can own ...?",
	// "Add KPI/Task to Key Result Type?") is the row's `span.settings-label`.
	subheaderTextCss: 'ga-goal-settings form.settings-form :is(.settings-title, .settings-label)',
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
