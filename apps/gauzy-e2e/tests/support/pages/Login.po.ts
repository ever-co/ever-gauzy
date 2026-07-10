import { expect } from '@playwright/test';
import { clearField, enterInput, clickButton, verifyElementIsVisible, getTitle } from '../util';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { LoginPage } from '../../../src/support/Base/pageobjects/LoginPageObject';
import { LoginPageData } from '../../../src/support/Base/pagedata/LoginPageData';

export const clearEmailField = async () => clearField(LoginPage.emailInputFieldCss);
export const enterEmail = async (data: string) => enterInput(LoginPage.emailInputFieldCss, data);
export const verifyTitle = async () => expect(await getTitle()).toBe(LoginPageData.TitleText);
export const clearPasswordField = async () => clearField(LoginPage.passwordInputFieldCss);
export const enterPassword = async (data: string) => enterInput(LoginPage.passwordInputFieldCss, data);
export const clickLoginButton = async () => clickButton(LoginPage.loginButton);
export const verifyLoginText = async () => verifyElementIsVisible(LoginPage.loginHeadingCss);
export const verifyLoginButton = async () => verifyElementIsVisible(LoginPage.loginButton);
