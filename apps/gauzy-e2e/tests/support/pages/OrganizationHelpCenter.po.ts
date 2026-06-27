import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickButtonByIndex,
	waitElementToHide,
	clickElementByText,
	verifyText,
	verifyElementNotExist,
	clickButtonMultipleTimes,
	verifyElementIsVisibleByIndex,
	enterTextInIFrame,
	clickElementIfVisible,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationHelpCenterPage } from '../../../src/support/Base/pageobjects/OrganizationHelpCenterPageObject';

export const addButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.addButtonCss);
};

export const clickAddButton = async () => {
	await clickButton(OrganizationHelpCenterPage.addButtonCss);
};

export const languageDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.languageDropdownCss);
};

export const clickLanguageDropdown = async () => {
	// Language is an ng-select that opens on MOUSEDOWN and is backdrop-blocked; a force-click on the
	// control can also CLOSE the add-base dialog. Just focus its input here — the actual open happens via
	// keyboard in selectLanguageFromDropdown (see Clients.po / ContactsLeads.po for the proven pattern).
	await getPage().locator(OrganizationHelpCenterPage.languageDropdownCss).locator('input').first().focus();
};

export const selectLanguageFromDropdown = async (text: string) => {
	const page = getPage();
	const input = page.locator(OrganizationHelpCenterPage.languageDropdownCss).locator('input').first();
	const option = page.locator(OrganizationHelpCenterPage.languageOptionCss);
	// Open the ng-select via keyboard typeahead (filters the list too) instead of a click that the
	// mousedown-open + leaked backdrop would swallow. Retry a few times until the option list appears.
	for (let i = 0; i < 5; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await input.focus().catch(() => {});
		await input.pressSequentially(String(text).slice(0, 4), { delay: 60 }).catch(() => {});
		await page.waitForTimeout(900);
	}
	await clickElementByText(OrganizationHelpCenterPage.languageOptionCss, text);
};

export const publishButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.toggleButtonCss);
};

export const clickPublishButton = async () => {
	await clickButton(OrganizationHelpCenterPage.toggleButtonCss);
};

export const iconDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.iconDropdownCss);
};

export const clickIconDropdown = async () => {
	await clickButton(OrganizationHelpCenterPage.iconDropdownCss);
};

export const selectIconFromDropdown = async (index: number) => {
	// Icon options live in the nb-select overlay (.option-list nb-option) — pick from that list
	// specifically so we never land on a leftover language ng-option from the previous dropdown.
	await clickButtonByIndex(OrganizationHelpCenterPage.iconOptionCss, index);
};

export const colorInputVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.colorInputCss);
};

export const enterColorInputData = async (data: string) => {
	await clearField(OrganizationHelpCenterPage.colorInputCss);
	await enterInput(OrganizationHelpCenterPage.colorInputCss, data);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationHelpCenterPage.nameInputCss);
	await enterInput(OrganizationHelpCenterPage.nameInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.descriptioninputCss);
};

export const enterDescriptionInputData = async (data: string) => {
	await clearField(OrganizationHelpCenterPage.descriptioninputCss);
	await enterInput(OrganizationHelpCenterPage.descriptioninputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Selecting the icon from the nb-select overlay leaves a fading cdk-overlay-backdrop on top of the
	// dialog footer; a coordinate click would land on it. Settle the spinner then dispatch the click
	// straight to the (enabled — form is valid) Save button so its handler fires regardless. (ROOT CAUSE 2)
	await waitForSpinnerGone();
	await dispatchClick(OrganizationHelpCenterPage.saveButtonCss);
};

export const settingsButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsButtonCss);
};

export const clickSettingsButton = async (index: number) => {
	// The settings gear is clicked right after a save/delete mutation whose dialog leaves a fading
	// backdrop; dispatch the click straight to the nb-action so its nbContextMenu opens regardless of an
	// overlaying backdrop. (ROOT CAUSE 2)
	await waitForSpinnerGone();
	await getPage().locator(OrganizationHelpCenterPage.settingsButtonCss).nth(index).dispatchEvent('click');
};

export const editBaseOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsDropdownOptionCss);
};

export const clickEditBaseOption = async (text: string) => {
	await clickElementByText(OrganizationHelpCenterPage.settingsDropdownOptionCss, text);
};

export const deleteBaseOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsDropdownOptionCss);
};

export const clickDeleteBaseOption = async (text: string) => {
	await clickElementByText(OrganizationHelpCenterPage.settingsDropdownOptionCss, text);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// Delete confirm sits in a freshly opened nb-dialog; the context-menu overlay it replaced can leave a
	// fading backdrop over the footer. Dispatch the click straight to the danger button. (ROOT CAUSE 2)
	await waitForSpinnerGone();
	await dispatchClick(OrganizationHelpCenterPage.deleteButtonCss);
};

export const clickCloseDeleteButton = async (times: number) => {
	await clickButtonMultipleTimes(OrganizationHelpCenterPage.closeDeleteButtonCss, times);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationHelpCenterPage.toastrMessageCss);
};

export const verifyBaseExists = async (text: string) => {
	await verifyText(OrganizationHelpCenterPage.verifyBaseCss, text);
};

export const verifyBaseIsDeleted = async () => {
	await verifyElementNotExist(OrganizationHelpCenterPage.verifyBaseCss);
};

export const clickAddCategoryOption = async (text: string) => {
	await clickElementByText(OrganizationHelpCenterPage.settingsDropdownOptionCss, text);
};

export const addCategoryOptionVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.settingsDropdownOptionCss);
};

export const verifyCategoryExists = async (text: string) => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.verifyCategortCss);
};

export const arrowButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.arrowButtonCss);
};

export const clickArrowButton = async (index: number) => {
	await clickElementIfVisible(OrganizationHelpCenterPage.arrowButtonCss, index);
};

export const clickOnCategory = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.verifyCategortCss, index);
};

export const verifyAddArticleButton = async (index: number) => {
	await verifyElementIsVisibleByIndex(OrganizationHelpCenterPage.addArticleButtonCss, index);
};

export const clickOnAddArticleButton = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.addArticleButtonCss, index);
};

export const verifyNameOfTheArticleInput = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.nameOfTheArticleInputCss);
};

export const enterArticleName = async (articleName: string) => {
	await enterInput(OrganizationHelpCenterPage.nameOfTheArticleInputCss, articleName);
};

export const verifyDescOfTheArticleInput = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.descOfTheArticleInputCss);
};

export const enterDescName = async (descName: string) => {
	await enterInput(OrganizationHelpCenterPage.descOfTheArticleInputCss, descName);
};

export const verifyEmployeePlaceholderField = async (index: number) => {
	await verifyElementIsVisibleByIndex(OrganizationHelpCenterPage.employeePlaceholderCss, index);
};

export const clickOnEmployeePlaceholderField = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.employeePlaceholderCss, index);
};

export const clickEmployeeDropdown = async (index: number) => {
	await clickButtonByIndex(OrganizationHelpCenterPage.employeeDropdownCss, index);
};

export const verifyArticleText = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.articleTextCss);
};

export const enterArticleText = async (text: string) => {
	await enterTextInIFrame(OrganizationHelpCenterPage.articleTextCss, text);
};

export const clickArticleText = async () => {
	await clickButton(OrganizationHelpCenterPage.articleTextCss);
};

export const verifyArticleSaveBtn = async () => {
	await verifyElementIsVisible(OrganizationHelpCenterPage.articleSaveBtnCss);
};

export const clickArticleSaveBtn = async () => {
	await clickButton(OrganizationHelpCenterPage.articleSaveBtnCss);
};
