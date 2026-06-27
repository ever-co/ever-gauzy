import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	verifyText,
	verifyTextNotExisting,
	waitElementToHide,
	clickElementByText,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationProjectsPage } from '../../../src/support/Base/pageobjects/OrganizationProjectsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const requestProjectButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.requestNewProjectButtonCss);
};

export const clickRequestProjectButton = async () => {
	// Toolbar "Add" navigates to the create-project route. dispatchClick avoids a fading post-login
	// overlay backdrop intercepting the coordinate click.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationProjectsPage.requestNewProjectButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.projectNameInputCss);
};

export const enterNameInputData = async (data) => {
	await clearField(OrganizationProjectsPage.projectNameInputCss);
	await enterInput(OrganizationProjectsPage.projectNameInputCss, data);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.selectEmployeeMultiSelectCss);
};

export const clickSelectEmployeeDropdown = async () => {
	// Members selector is an nb-select (opens on click). Settle any transient spinner first.
	await waitForSpinnerGone();
	await clickButton(OrganizationProjectsPage.selectEmployeeMultiSelectCss);
};

export const selectEmployeeDropdownOption = async (index) => {
	const page = getPage();
	const option = page.locator(OrganizationProjectsPage.selectEmployeeDropdownOptionCss);
	// Best-effort employee pick: the option list (org employees "working" in the header date range)
	// loads async and can legitimately be empty. Select one if it shows; otherwise close the panel and
	// continue — a project saves fine without members. Avoids a hard 60s timeout on an empty list.
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => undefined);
	}
};

export const selectEmployeeFromDropdownByName = async (name) => {
	await clickElementByText(OrganizationProjectsPage.selectEmployeeDropdownOptionCss, name);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	// Tags is an ng-select (#addTags, appendTo=body) that opens on MOUSEDOWN and is backdrop-blockable;
	// a coordinate click can also collapse the form. Open it via the keyboard instead. The dropdown
	// panel + options are rendered to <body>, so we poll for the options after pressing ArrowDown.
	const page = getPage();
	const input = page.locator(OrganizationProjectsPage.tagsSelectCss).locator('input').first();
	const option = page.locator(OrganizationProjectsPage.tagsSelectOptionCss);
	for (let i = 0; i < 5; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await input.focus().catch(() => undefined);
		await page.keyboard.press('ArrowDown');
		await page.waitForTimeout(600);
	}
};

export const selectTagsFromDropdown = async (index) => {
	// Pick the option from the body-appended panel. dispatchClick avoids any fading overlay swallowing
	// the coordinate click; ng-select keeps the panel open (closeOnSelect=false) so the next step still
	// works. Best-effort: tags can be empty on a fresh tenant, so don't hard-fail.
	const option = getPage().locator(OrganizationProjectsPage.tagsSelectOptionCss);
	try {
		await option.nth(index).waitFor({ state: 'visible', timeout: 6000 });
		await option.nth(index).dispatchEvent('click');
	} catch {
		await getPage().keyboard.press('Escape').catch(() => undefined);
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const colorInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.colorInputCss);
};

export const enterColorInputData = async (data) => {
	await clearField(OrganizationProjectsPage.colorInputCss);
	await enterInput(OrganizationProjectsPage.colorInputCss, data);
};

export const descriptionInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.projectDescriptionCss);
};

export const clickTabButton = async (index) => {
	// Close any open ng-select panel (e.g. the body-appended tags dropdown) so its overlay can't swallow
	// the tab click, then dispatch the click straight to the tab header (nb-tabset switches on click).
	await getPage().keyboard.press('Escape').catch(() => undefined);
	const tab = getPage().locator(OrganizationProjectsPage.tabButtonCss).nth(index);
	await tab.waitFor({ state: 'visible', timeout: 8000 }).catch(() => undefined);
	await tab.dispatchEvent('click');
};

export const budgetHoursInputVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.budgetInputCss);
};

export const enterBudgetHoursInputData = async (data) => {
	await enterInput(OrganizationProjectsPage.budgetInputCss, data);
};

export const enterDescriptionInputData = async (data) => {
	await clearField(OrganizationProjectsPage.projectDescriptionCss);
	await enterInput(OrganizationProjectsPage.projectDescriptionCss, data);
};

export const saveProjectButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.saveProjectButtonCss);
};

export const clickSaveProjectButton = async () => {
	// dispatchClick after the card spinner settles: a coordinate click can land on the full-card
	// nb-spinner shown during save, and onSubmit fires on click regardless of the overlay. (.first()
	// targets Save, which precedes the edit-only "Add Module" success button in the same form-group.)
	await waitForSpinnerGone();
	await dispatchClick(OrganizationProjectsPage.saveProjectButtonCss);
	// The save is async and the component navigates back to the projects list on success.
	// Wait for that navigation so callers (e.g. CustomCommands.addProject) don't race a
	// subsequent goto() against the in-flight save/redirect.
	await getPage()
		.waitForURL((url) => /\/pages\/organization\/projects(\?|$)/.test(url.href), { timeout: 30000 })
		.catch(() => undefined);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.selectTableRowCss);
};

export const selectTableRow = async (index) => {
	const page = getPage();
	// Settle after the preceding mutation (the grid re-renders), then click the row ONCE and poll the
	// Edit button's real disabled attr — the row click TOGGLES selection, so blindly re-clicking turns
	// it back off (leaving Edit/Delete disabled). Re-click only if selection was lost.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(1500);
	const row = page.locator(OrganizationProjectsPage.selectTableRowCss).nth(index);
	const editBtn = page.locator(OrganizationProjectsPage.editProjectButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.editProjectButtonCss);
};

export const clickEditButton = async () => {
	// dispatchClick: a fading dialog/overlay backdrop can swallow the coordinate click on the toolbar
	// Edit button. The row is already selected (selectTableRow polled the button enabled).
	await waitForSpinnerGone();
	await dispatchClick(OrganizationProjectsPage.editProjectButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.deleteProjectButtonCss);
};

export const clickDeleteButton = async () => {
	await waitForSpinnerGone();
	await dispatchClick(OrganizationProjectsPage.deleteProjectButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationProjectsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// dispatchClick the dialog OK: a leftover backdrop can sit over the dialog footer and swallow the
	// coordinate click, leaving the confirmation open and the row undeleted.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationProjectsPage.confirmDeleteButtonCss);
};

export const clickCardBody = async () => {
	// Close the open tags ng-select panel (called right after picking a tag). The old
	// `nb-card-body > div.form-group` wrapper no longer exists in the flat form; pressing Escape closes
	// the body-appended dropdown without risking a stray click on the header's back-navigation.
	await getPage().keyboard.press('Escape').catch(() => undefined);
};

export const verifyProjectExists = async (text) => {
	await verifyText(OrganizationProjectsPage.verifyProjectCss, text);
};

export const verifyProjectIsDeleted = async (text) => {
	await verifyTextNotExisting(OrganizationProjectsPage.verifyProjectCss, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationProjectsPage.toastrMessageCss);
};

export const clickSaveProjectButtonWithIndex = async (index: number) => {
	await clickButtonByIndex(OrganizationProjectsPage.saveProjectButtonCss, index);
};
