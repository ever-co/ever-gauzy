export const OnboardingPage = {
	organizationNameFieldCss: '#nameInput',
	currencyFieldCss: 'ng-select.currency-selector',
	currencyOptionCss: '.ng-dropdown-panel .ng-option',
	officialNameFieldCss: '#officialNameInput',
	taxFieldCss: '#taxIdInput',
	// The step form's actions moved to the card footer in #10608 (ffc762ee8a); there is no submit button.
	nextButtonCss: 'ga-organizations-step-form nb-card-footer.dialog-footer button[status="primary"]',
	// onboarding-complete.component.html: one nb-card.shortcut-card per feature block; the (click) that
	// navigates sits on the card, the description text is `nb-card-body > div.shortcut > div`.
	gotoDashboardCardCss: 'ga-onboarding-complete nb-card.shortcut-card nb-card-body > div.shortcut > div',
	completePageHeadingCss: 'ga-onboarding-complete > div.logo > h6'
};
