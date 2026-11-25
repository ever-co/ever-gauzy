export const EditProfilePage = {
	firstNameInputCss: '#firstName',
	lastNameInputCss: '#lastName',
	passwordInputCss: '[placeholder="Password"]',
	repeatPasswordInputCss: '[placeholder="Repeat Password"]',
	emailInputCss: '#email',
	preferredLanguageCss: 'ngx-language-selector ng-select',
	languageSelectCss: 'div > div.form-group > ngx-language-selector > ng-select',
	// See EditUserPageObject: #9975's `ng-option-tmp` on the language selector removed ng-select's
	// default `span.ng-option-label`. This spec's chooseLanguage swallows its own failure, so the
	// stale selector was passing VACUOUSLY rather than failing — worth fixing for real coverage.
	preferredLanguageOptionCss: 'ng-dropdown-panel div.ng-option',
	// The redesigned profile form keeps its Save button in `footer.profile__actions`
	// (packages/ui-core/shared/src/lib/user/edit-profile-form/edit-profile-form.component.html).
	saveButtonCss: 'footer.profile__actions > button[status="success"]'
};
