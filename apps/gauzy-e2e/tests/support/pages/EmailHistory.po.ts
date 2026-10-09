import { expect } from '@playwright/test';
import { getPage } from '../page-context';
import {
	verifyElementIsVisible,
	clickButton,
	verifyText,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	clickButtonDouble
} from '../util';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EmailHistoryPage } from '../../../src/support/Base/pageobjects/EmailHistoryPageObject';

export const verifyHeaderText = async (text: string) => {
	await verifyText(EmailHistoryPage.headerTextCss, text);
};

export const filterButtonVisible = async () => {
	await verifyElementIsVisible(EmailHistoryPage.filterButtonCss);
};

export const clickFilterButton = async () => {
	await clickButton(EmailHistoryPage.filterButtonCss);
};

export const templatesDropdownVisible = async () => {
	await verifyElementIsVisible(EmailHistoryPage.emailTemplatesDropdownCss);
};

export const clickTemplatesDropdown = async () => {
	await clickButton(EmailHistoryPage.emailTemplatesDropdownCss);
};

export const verifyDropdownText = async (text: string) => {
	await verifyText(EmailHistoryPage.dropdownOptionCss, text);
};

export const selectOptionFromDropdown = async (text: string) => {
	await clickElementByText(EmailHistoryPage.dropdownOptionCss, text);
};

export const verifyBadgeExist = async () => {
	await verifyElementIsVisible(EmailHistoryPage.badgeCss);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(EmailHistoryPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	await clickButton(EmailHistoryPage.saveButtonCss);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickTemplatesDropdownDouble = async () => {
	await clickButtonDouble(EmailHistoryPage.emailTemplatesDropdownCss);
};

/**
 * The Template filter of the filter bar groups its options under the template title and shows only
 * the language as the option. An option written "Title - Language" (as the old filters dialog listed
 * it) is therefore the language option whose nearest group heading above it is that title.
 */
const templateOptionLoc = (text: string) => {
	const [title, language] = text.split(' - ').map((part) => part.trim());
	const hasClass = (name: string) => `contains(concat(' ', normalize-space(@class), ' '), ' ${name} ')`;
	return getPage().locator(
		`xpath=//div[${hasClass('ng-option')}][normalize-space()='${language}']` +
			`[preceding-sibling::div[${hasClass('ng-optgroup')}][1][normalize-space()='${title}']]`
	);
};

export const templateFilterVisible = async () => {
	await verifyElementIsVisible(EmailHistoryPage.templateFilterCss);
};

export const openTemplateFilter = async () => {
	await clickButton(EmailHistoryPage.templateFilterCss);
};

export const verifyTemplateOption = async (text: string) => {
	await expect(templateOptionLoc(text).first()).toBeVisible({ timeout: 24_000 });
};

export const selectTemplateOption = async (text: string) => {
	await templateOptionLoc(text).first().click({ force: true, timeout: 60_000 });
};

export const verifyActiveFilterChip = async (text: string) => {
	await verifyText(EmailHistoryPage.activeFilterChipCss, text);
};
