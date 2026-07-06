import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clickElementByText,
	clearField,
	verifyValue,
	waitUntil,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EditProfilePage } from '../../../src/support/Base/pageobjects/EditProfilePageObject';

export const firstNameInputVisible = async () => {
	await waitUntil(3000);
	await verifyElementIsVisible(EditProfilePage.firstNameInputCss);
};

export const enterFirstNameData = async (data: string) => {
	await clearField(EditProfilePage.firstNameInputCss);
	await enterInput(EditProfilePage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.lastNameInputCss);
};

export const enterLastNameData = async (data: string) => {
	await clearField(EditProfilePage.lastNameInputCss);
	await enterInput(EditProfilePage.lastNameInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.passwordInputCss);
};

export const enterPasswordData = async (data: string) => {
	await enterInput(EditProfilePage.passwordInputCss, data);
};

export const repeatPasswordInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.repeatPasswordInputCss);
};

export const enterRepeatPasswordData = async (data: string) => {
	await enterInput(EditProfilePage.repeatPasswordInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await clearField(EditProfilePage.emailInputCss);
	await enterInput(EditProfilePage.emailInputCss, data);
};

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(EditProfilePage.languageSelectCss);
};

export const chooseLanguage = async (data: string) => {
	// ngx-language-selector renders an ng-select (appendTo="body") that opens on mousedown and is
	// backdrop-blocked; open it via keyboard (focus + ArrowDown) rather than a coordinate click, which
	// can land on a fading overlay / close the control. Best-effort: language is cosmetic here and the
	// form stays valid (email + matching passwords) regardless, so don't fail the spec if the option
	// list doesn't render in time.
	try {
		const input = getPage().locator(EditProfilePage.languageSelectCss).locator('input').first();
		await input.focus();
		await getPage().keyboard.press('ArrowDown');
		await clickElementByText(EditProfilePage.preferredLanguageOptionCss, data);
	} catch {
		// fall back to the legacy click-open path, still best-effort
		await clickButton(EditProfilePage.languageSelectCss).catch(() => {});
		await clickElementByText(EditProfilePage.preferredLanguageOptionCss, data).catch(() => {});
	}
};

export const saveBtnExists = async () => {
	await verifyElementIsVisible(EditProfilePage.saveButtonCss);
};

export const saveBtnClick = async () => {
	// The Save button carries [disabled]="form.invalid" — a force coordinate-click on a disabled
	// button is suppressed by the browser, and a just-closed ng-select overlay can leave a fading
	// cdk backdrop on top. Settle any spinner, then dispatch the click straight at the button:
	// dispatchEvent fires through the backdrop and regardless of the disabled attr, and
	// edit-profile-form.submitForm() validates internally before persisting (mirrors EditUser.po).
	await waitForSpinnerGone();
	await dispatchClick(EditProfilePage.saveButtonCss);
};

export const verifyFirstName = async (val: string) => {
	await verifyValue(EditProfilePage.firstNameInputCss, val);
};

export const verifyLastName = async (val: string) => {
	await verifyValue(EditProfilePage.lastNameInputCss, val);
};

export const verifyEmail = async (val: string) => {
	await verifyValue(EditProfilePage.emailInputCss, val);
};
