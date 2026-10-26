import { expect } from '@playwright/test';
import {
	applySmartTableFilter,
	clearField,
	clickButton,
	clickByText,
	clickElementByText,
	enterInput,
	scrollUp,
	verifyByText,
	verifyElementIsVisible,
	waitElementToHide,
	waitUntil,
	clickButtonByIndex,
	verifyText,
	getLastElement,
	dispatchClickWhenSettled,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationPublicPage } from '../../../src/support/Base/pageobjects/OrganizationPublicPagePageObject';
// The organization is created through the same Add Organization dialog the add-organization spec drives.
import * as addOrganizationPage from './AddOrganization.po';

export const organizationDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.organizationDropdownCss);
};

export const clickOrganizationDropdown = async () => {
	await clickButton(OrganizationPublicPage.organizationDropdownCss);
};

export const selectOrganization = async (name: string) => {
	await clickElementByText(OrganizationPublicPage.organizationDropdownOptionsCss, name);
};

// Add new public profile link
export const organizationNameFilterInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.nameFilterInputCss);
};

export const enterOrganizationNameFilterInputData = async (name: string) => {
	// The plain enterInput() (.fill()) left the grid unfiltered — see applySmartTableFilter — so the
	// freshly created organization stayed off page 1 and the profile-link flow silently fell into its
	// best-effort catch.
	await applySmartTableFilter(OrganizationPublicPage.nameFilterInputCss, name);
};

export const verifyOrganizationNameTableRowContains = async (text: string) => {
	await verifyByText(OrganizationPublicPage.organizationNameTableCellCss, text);
};

export const selectOrganizationTableRow = async () => {
	await clickButton(OrganizationPublicPage.organizationTableRowCss);
};

export const manageBtnExists = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.manageButtonCss);
};

// Manage sits in the toolbar's selection strip, which slides in (~0.2s) once the row is selected and is
// [disabled] until then; a coordinate click during the slide lands elsewhere. Wait until it is enabled,
// dispatch the click at it (once — it navigates away), and wait for the edit page's Main tab to render.
export const manageBtnClick = async () => {
	const page = getPage();
	await expect(page.locator(OrganizationPublicPage.manageButtonCss).first()).toBeEnabled({ timeout: 24_000 });
	await waitForSpinnerGone();
	await dispatchClick(OrganizationPublicPage.manageButtonCss);
	await page
		.locator(OrganizationPublicPage.profileLinkInputCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30_000 });
};

/**
 * The organization id from the edit page URL (`/pages/organizations/edit/<id>/main`).
 *
 * The public page route is `/share/organization/:profileLink/:organizationId` (public-layout.routes.ts,
 * since 111390d137 "add organization UUID for public page"); the old `/share/organization/:profileLink`
 * the Cypress spec navigated to now renders NotFound. The edit page's own "Edit public page" button builds
 * the same URL from `profile_link` + `id` and opens it in a NEW TAB (window.open), so the spec reads the id
 * here and navigates in the same page instead.
 */
export const getEditedOrganizationId = async (): Promise<string> => {
	const page = getPage();
	const pattern = /\/pages\/organizations\/edit\/([^/?#]+)/;
	await expect
		.poll(() => pattern.test(page.url()), {
			timeout: 24_000,
			message: 'Not on an organization edit page (/pages/organizations/edit/<id>)'
		})
		.toBe(true);
	return page.url().match(pattern)[1];
};

export const profileLinkInputVisible = async () => {
	await waitUntil(3000);
	await verifyElementIsVisible(OrganizationPublicPage.profileLinkInputCss);
};

export const enterProfileLinkInputData = async (data: string) => {
	await clearField(OrganizationPublicPage.profileLinkInputCss);
	await enterInput(OrganizationPublicPage.profileLinkInputCss, data);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.saveButtonCss);
};

// Main tab Save: `[disabled]="form.invalid"` (profile_link must match ^[a-z0-9-]+$), and a successful save
// returns to the organizations list (edit-organization-main updateOrganizationSettings) — wait for both so
// a save that did not take fails here.
export const clickSaveButton = async () => {
	const page = getPage();
	await waitForSpinnerGone();
	await expect(page.locator(OrganizationPublicPage.saveButtonCss).first()).toBeEnabled({ timeout: 24_000 });
	await dispatchClick(OrganizationPublicPage.saveButtonCss);
	await expect
		.poll(() => page.url().includes('/pages/organizations/edit/'), {
			timeout: 24_000,
			message: 'Saving the organization profile link did not return to the organizations list'
		})
		.toBe(false);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationPublicPage.toastrMessageCss);
};

// Edit public page
export const editPageButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.editPageButtonCss);
};

export const clickEditPageButton = async () => {
	await clickButton(OrganizationPublicPage.editPageButtonCss);
};

export const companyNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.companyNameInputCss);
};

// The Cypress original TYPED the copyright sign after the existing company name (`cy.type` appends);
// Playwright's fill() replaced the whole name with " ©". Append at the end of the current value instead.
export const enterCompanyNameInputData = async (data: string) => {
	const input = getPage().locator(OrganizationPublicPage.companyNameInputCss).first();
	await input.click({ timeout: 60_000 });
	await input.press('End');
	await input.pressSequentially(data);
};

export const companySizeInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.companySizeInputCss);
};

export const enterCompanySizeInputData = async (data: number) => {
	await clearField(OrganizationPublicPage.companySizeInputCss);
	await enterInput(OrganizationPublicPage.companySizeInputCss, String(data));
};

export const yearFoundedInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.yearFoundedInputCss);
};

export const enterYearFoundedInputData = async (data: number) => {
	await clearField(OrganizationPublicPage.yearFoundedInputCss);
	await enterInput(OrganizationPublicPage.yearFoundedInputCss, String(data));
};

export const bannerInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.bannerInputCss);
};

export const enterBannerInputData = async (data: string) => {
	await enterInput(OrganizationPublicPage.bannerInputCss, data);
};

export const minimumProjectSizeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.minimumProjectSizeDropdownCss);
};

export const clickMinimumProjectSizeDropdown = async () => {
	await clickButton(OrganizationPublicPage.minimumProjectSizeDropdownCss);
};

export const selectMinimumProjectSizeDropdownOption = async (text: string) => {
	await clickByText(OrganizationPublicPage.minimumProjectSizeDropdownOptionsCss, text);
};

export const clientFocusDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.clientFocusDropdownCss);
};

export const clickClientFocusDropdown = async () => {
	await clickButton(OrganizationPublicPage.clientFocusDropdownCss);
};

export const selectClientFocusDropdownOptions = async (text: string) => {
	await clickByText(OrganizationPublicPage.clientFocusDropdownOptionsCss, text);
};

export const descriptionTabVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardsTabCss);
};

export const clickDescriptionTab = async () => {
	await clickByText(OrganizationPublicPage.awardsTabCss, 'Description');
};

export const shortDescriptionVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.shortDescriptionInputCss);
};

export const enterShortDescriptionInputData = async (data: string) => {
	await enterInput(OrganizationPublicPage.shortDescriptionInputCss, data);
};

export const awardsTabVisible = async () => {
	await scrollUp(OrganizationPublicPage.cardBodyCss);
	await verifyElementIsVisible(OrganizationPublicPage.awardsTabCss);
};

export const clickAwardsTab = async () => {
	await clickByText(OrganizationPublicPage.awardsTabCss, 'Awards');
};

export const addAwardsButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.addAwardsButtonCss);
};

export const clickAwardButton = async () => {
	await clickButton(OrganizationPublicPage.addAwardsButtonCss);
};

export const awardNameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardNameInputCss);
};

export const enterAwardNameInputData = async (data: string) => {
	await enterInput(OrganizationPublicPage.awardNameInputCss, data);
};

export const awardYearInputVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardYearInputCss);
};

export const enterAwardYearInputData = async (data: number) => {
	await enterInput(OrganizationPublicPage.awardYearInputCss, String(data));
};

export const awardsSaveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.awardsSaveButtonCss);
};

export const clickAwardsSaveButton = async () => {
	await clickButton(OrganizationPublicPage.awardsSaveButtonCss);
};

export const skillsTabVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.skillsTabCss);
};

export const clickSkillsTab = async () => {
	await clickByText(OrganizationPublicPage.skillsTabCss, 'Skills');
};

export const skillsDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.skillsDropdownCss);
};

export const clickSkillsDropdown = async () => {
	await clickButton(OrganizationPublicPage.skillsDropdownCss);
};

export const selectSkillsFromDropdownOptions = async (options: string[]) => {
	for (let index = 0; index < options.length; index++) {
		const option = options[index];
		if (index === 0) {
			await clickByText(OrganizationPublicPage.skillsDropdownOptionsCss, option);
			continue;
		}

		await clickSkillsDropdown();
		await clickByText(OrganizationPublicPage.skillsDropdownOptionsCss, option);
	}
};

export const languagesTabVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languagesTabCss);
};

export const clickLanguagesTab = async () => {
	await clickByText(OrganizationPublicPage.languagesTabCss, 'Languages');
};

export const addLanguageButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.addLanguageButtonCss);
};

export const clickAddLanguageButton = async () => {
	await clickButton(OrganizationPublicPage.addLanguageButtonCss);
};

export const languageDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languageDropdownCss);
};

export const clickLanguageDropdown = async () => {
	await clickButton(OrganizationPublicPage.languageDropdownCss);
};

export const selectLanguageFromDropdownOptions = async (text: string) => {
	await clickByText(OrganizationPublicPage.languageDropdownOptionsCss, text);
};

export const languageLevelDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languageLevelDropdownCss);
};

export const selectLanguageLevelFromDropdownOptions = async (text: string) => {
	await clickByText(OrganizationPublicPage.languageLevelDropdownOptionsCss, text);
};

export const clickLanguageLevelDropdown = async () => {
	await clickButton(OrganizationPublicPage.languageLevelDropdownCss);
};

export const languagesSaveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.languageSaveButtonCss);
};

export const clickLanguagesSaveButton = async () => {
	await clickButton(OrganizationPublicPage.languageSaveButtonCss);
};

export const updateButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.updateButtonCss);
};

export const clickUpdateButton = async () => {
	await clickButton(OrganizationPublicPage.updateButtonCss);
};

// Verify public page data
export const verifyCompanyName = async (text: string) => {
	await verifyByText(OrganizationPublicPage.companyNameCss, text);
};

export const verifyBanner = async (text: string) => {
	await verifyByText(OrganizationPublicPage.bannerCss, text);
};

export const verifyCompanySize = async (text: string) => {
	await verifyByText(OrganizationPublicPage.companySizeCss, text);
};

export const verifyTotalClients = async (text: string) => {
	await verifyByText(OrganizationPublicPage.totalClientsCss, text);
};

export const verifyClientFocus = async (text: string) => {
	await verifyByText(OrganizationPublicPage.clientFocusCss, text);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addBtnExists = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.addButtonCss);
};

export const addBtnClick = async () => {
	// Confirm the mutation dialog actually mounted rather than assuming the click landed. The grid card
	// is `[nbSpinner]="loading"` and the toolbar sits inside ngx-gauzy-button-action's slide-in, so a
	// coordinate click issued ~800ms after the hash navigation can be delivered to the overlay instead
	// of the button. Nothing downstream notices: the next step is `clearField(organizationNameField)`,
	// which then burns the full 24s actionTimeout waiting for an input that was never opened.
	//
	// The sibling page object driving this same dialog (AddOrganization.po.ts) already confirms; this
	// copy was simply never updated.
	await dispatchClickWhenSettled(
		OrganizationPublicPage.addButtonCss,
		OrganizationPublicPage.organizationNameFieldCss
	);
};

export const verifyOrganisationNameField = async () => {
	await verifyElementIsVisible(OrganizationPublicPage.organizationNameFieldCss);
};

export const enterOrganizationName = async (data) => {
	await clearField(OrganizationPublicPage.organizationNameFieldCss);
	await enterInput(OrganizationPublicPage.organizationNameFieldCss, data);
};

export const selectCurrency = async (data) => {
	// Currency is a <ga-currency> host wrapping <ng-select class="currency-selector"> (appendTo="body").
	// The old '#currencySelect' id only exists on an optional <label for>, not the control; open the
	// ng-select and pick from the body-level ng-dropdown-panel (ng-option), matching AddOrganizationPageObject.
	await clickButton('ga-currency ng-select');
	await clickByText('ng-dropdown-panel div.ng-option', data);
};

export const enterOfficialName = async (data) => {
	await enterInput(OrganizationPublicPage.officialNameFieldCss, data);
};

export const enterTaxId = async (data) => {
	await enterInput(OrganizationPublicPage.taxFieldCss, data);
};

// Steps 1-4 of the Add Organization dialog (ga-organizations-step-form) — the SAME dialog the
// add-organization spec drives, so the same driver is used (AddOrganization.po): DOM-dispatched dropdowns
// and the footer's primary action. #10608 (ffc762ee8a) moved the step actions out of nb-stepper into
// nb-card-footer.dialog-footer, so the old `button[type="submit"]` matched nothing and the first
// "Next" timed out; advanceStepForm presses "Continue" / "Create organization" and proves each took.
export const clickOnNextButton = async () => {
	await addOrganizationPage.advanceStepForm();
};

export const verifyOrganizationExists = async (text) => {
	await verifyText(OrganizationPublicPage.verifyOrganizationCss, text);
};

export const countryDropdownVisible = addOrganizationPage.countryDropdownVisible;
export const clickCountryDropdown = addOrganizationPage.clickCountryDropdown;
export const selectCountryFromDropdown = addOrganizationPage.selectCountryFromDropdown;
export const cityInputVisible = addOrganizationPage.cityInputVisible;
export const enterCityInputData = addOrganizationPage.enterCityInputData;
export const postcodeInputVisible = addOrganizationPage.postcodeInputVisible;
export const enterPostcodeInputData = addOrganizationPage.enterPostcodeInputData;
export const streetInputVisible = addOrganizationPage.streetInputVisible;
export const enterStreetInputData = addOrganizationPage.enterStreetInputData;
export const bonusTypeDropdownVisible = addOrganizationPage.bonusTypeDropdownVisible;
export const clickBonusTypeDropdown = addOrganizationPage.clickBonusTypeDropdown;
export const selectBonusTypeFromDropdown = addOrganizationPage.selectBonusTypeFromDropdown;
export const bonusPercentageInputVisible = addOrganizationPage.bonusPercentageInputVisible;
export const enterBonusPercentageInputData = addOrganizationPage.enterBonusPercentageInputData;
export const expiryPeriodInputVisible = addOrganizationPage.expiryPeriodInputVisible;
export const enterExpiryPeriodInputData = addOrganizationPage.enterExpiryPeriodInputData;
export const timeZoneDropdownVisible = addOrganizationPage.timeZoneDropdownVisible;
export const clickTimeZoneDropdown = addOrganizationPage.clickTimeZoneDropdown;
export const selectTimeZoneFromDropdown = addOrganizationPage.selectTimeZoneFromDropdown;
export const startOfWeekDropdownVisible = addOrganizationPage.startOfWeekDropdownVisible;
export const clickStartOfWeekDropdown = addOrganizationPage.clickStartOfWeekDropdown;
export const selectStartOfWeekFromDropdown = addOrganizationPage.selectStartOfWeekFromDropdown;
export const dateTypeDropdownVisible = addOrganizationPage.dateTypeDropdownVisible;
export const clickDateTypeDropdown = addOrganizationPage.clickDateTypeDropdown;
export const selectDateTypeFromDropdown = addOrganizationPage.selectDateTypeFromDropdown;
export const regionDropdownVisible = addOrganizationPage.regionDropdownVisible;
export const clickRegionDropdown = addOrganizationPage.clickRegionDropdown;
export const selectRegionFromDropdown = addOrganizationPage.selectRegionFromDropdown;
export const numberFormatDropdownVisible = addOrganizationPage.numberFormatDropdownVisible;
export const clickNumberFormatDropdown = addOrganizationPage.clickNumberFormatDropdown;
export const selectNumberFormatFromDropdown = addOrganizationPage.selectNumberFormatFromDropdown;
export const dateFormatDropdownVisible = addOrganizationPage.dateFormatDropdownVisible;
export const clickDateFormatDropdown = addOrganizationPage.clickDateFormatDropdown;
export const selectDateFormatFromDropdown = addOrganizationPage.selectDateFormatFromDropdown;

export const selectTableRow = async () => {
	await getLastElement(OrganizationPublicPage.tableRowCss);
};
