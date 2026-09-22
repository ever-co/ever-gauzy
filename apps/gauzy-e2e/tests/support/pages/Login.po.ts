import { expect } from '@playwright/test';
import { clearField, enterInput, clickWhenEnabled, verifyElementIsVisible, getTitle } from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { LoginPage } from '../../../src/support/Base/pageobjects/LoginPageObject';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';

export const clearEmailField = async () => clearField(LoginPage.emailInputFieldCss);
export const enterEmail = async (data: string) => enterInput(LoginPage.emailInputFieldCss, data);
export const verifyTitle = async () => expect(await getTitle()).toBe(LoginPageData.TitleText);
export const clearPasswordField = async () => clearField(LoginPage.passwordInputFieldCss);
export const enterPassword = async (data: string) => enterInput(LoginPage.passwordInputFieldCss, data);
// login.component.html: `[disabled]="submitted || !form.valid"`, and the password is filled a few ms
// earlier — the same disabled-race the register submit hit, and a forced click on a still-disabled
// button is dropped silently. Gate on enabled first. `force` is kept so the click behaviour is
// otherwise byte-identical for the many features whose Background logs in through here.
export const clickLoginButton = async () => clickWhenEnabled(LoginPage.loginButton, { force: true });
export const verifyLoginText = async () => verifyElementIsVisible(LoginPage.loginHeadingCss);
export const verifyLoginButton = async () => verifyElementIsVisible(LoginPage.loginButton);
