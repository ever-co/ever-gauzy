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
import { expect } from '@playwright/test';
import { selectNgOption } from '../ng-select';
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
	const page = getPage();
	const input = page.locator(OrganizationProjectsPage.projectNameInputCss).first();
	await input.waitFor({ state: 'visible', timeout: 24_000 });
	// On the EDIT page ga-project-mutation patches the form from the resolved project twice: when the
	// [project] input is set, and again from its debounced (100 ms) selectedOrganization$ subscription
	// (_syncProject in project-mutation.component.ts). A name typed in between is overwritten with the
	// stored one and the edit silently saves the old name. Wait for the stored name to land, let the
	// second patch pass, then type — and read the value back so an overwrite is retried, not missed.
	if (/\/pages\/organization\/projects\/[^/?#]+\/edit/.test(page.url())) {
		await expect(input).not.toHaveValue('', { timeout: 24_000 }).catch(() => undefined);
		await page.waitForTimeout(1000);
	}
	for (let attempt = 0; attempt < 3; attempt++) {
		await clearField(OrganizationProjectsPage.projectNameInputCss);
		await enterInput(OrganizationProjectsPage.projectNameInputCss, data);
		await page.waitForTimeout(400);
		if ((await input.inputValue().catch(() => '')) === String(data)) return;
	}
	await expect(input).toHaveValue(String(data), { timeout: 5_000 });
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
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(OrganizationProjectsPage.tagsSelectCss, OrganizationProjectsPage.tagsSelectOptionCss, index);
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

/**
 * The project form's sections, in the order the old <nb-tabset> rendered them for a project without a
 * GitHub integration (Sprints is only offered for a saved sprint-mode project, so it never sat between
 * these). Kept so a legacy numeric index still resolves to the same section: 1 = Description,
 * 3 = Budget, 5 = Settings.
 */
const LEGACY_PROJECT_TAB_ORDER = ['main', 'description', 'billing', 'budget', 'openSource', 'settings'];

/**
 * Open a section of the project form.
 *
 * Since #11177 (954aac863c, "Feat/polish project edit page") the form no longer uses <nb-tabset>
 * (`span.tab-text`); it renders its own tablist of `<button role="tab" id="project-form-tab-<id>">`
 * and hides the inactive panes with [hidden]. Prefer the section id (`'description'`, `'budget'`,
 * `'settings'`, ...); a number is mapped through the legacy nb-tabset order. Proves the switch via
 * aria-selected rather than assuming the click landed.
 */
export const clickTabButton = async (tab: number | string) => {
	const page = getPage();
	const id = typeof tab === 'number' ? LEGACY_PROJECT_TAB_ORDER[tab] : tab;
	if (!id) {
		throw new Error(`clickTabButton: no project form section for index ${tab}`);
	}
	// Close any open dropdown (the members nb-select overlay, the body-appended tags ng-select panel) so
	// it can't sit over the tablist. The form is a routed page, not an nb-dialog, so Escape is safe here.
	await page.keyboard.press('Escape').catch(() => undefined);
	const button = page.locator(`${OrganizationProjectsPage.projectFormTabIdPrefix}${id}`).first();
	await button.waitFor({ state: 'visible', timeout: 24_000 });
	for (let attempt = 0; attempt < 3; attempt++) {
		// DOM-level click: the (click)="selectTab(id)" handler fires even if a fading overlay covers the tab.
		await button.dispatchEvent('click');
		const selected = await expect(button)
			.toHaveAttribute('aria-selected', 'true', { timeout: 4_000 })
			.then(() => true)
			.catch(() => false);
		if (selected) return;
	}
	await expect(button).toHaveAttribute('aria-selected', 'true', { timeout: 4_000 });
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

const onProjectsList = (href: string) => /\/pages\/organization\/projects(\?|$)/.test(href);

export const clickSaveProjectButton = async () => {
	// Save is the action bar's status="primary" button (#11177), [disabled]="form.invalid". Wait for it to
	// be enabled (a click on a disabled button is dropped), then dispatch the click so the full-card
	// nb-spinner shown during the save can't intercept it.
	const page = getPage();
	const save = page.locator(OrganizationProjectsPage.saveProjectButtonCss).first();
	await waitForSpinnerGone();
	await expect(save).toBeEnabled({ timeout: 24_000 });
	await dispatchClick(OrganizationProjectsPage.saveProjectButtonCss);
	// The create/edit page saves asynchronously and then navigates back to the projects list. Wait for
	// that navigation so callers (e.g. CustomCommands.addProject) don't race a subsequent goto() against
	// the in-flight save/redirect. If the click was swallowed (still on the form, Save still there and
	// enabled, no save in flight), dispatch it once more.
	const navigated = await page
		.waitForURL((url) => onProjectsList(url.href), { timeout: 30_000 })
		.then(() => true)
		.catch(() => false);
	if (!navigated && !onProjectsList(page.url()) && (await save.isEnabled().catch(() => false))) {
		await waitForSpinnerGone();
		await dispatchClick(OrganizationProjectsPage.saveProjectButtonCss);
		await page.waitForURL((url) => onProjectsList(url.href), { timeout: 30_000 }).catch(() => undefined);
	}
};

/**
 * The project form closed back onto the projects list — i.e. the save went through (create/edit only
 * navigate away after the API accepted the project; an API error keeps the form open with a toast).
 */
export const verifyProjectFormClosed = async () => {
	const page = getPage();
	await page.waitForURL((url) => onProjectsList(url.href), { timeout: 30_000 });
	await expect(page.locator(OrganizationProjectsPage.projectFormCss)).toHaveCount(0, { timeout: 24_000 });
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
	// Assert on the Name column, matching the WHOLE name: a table-wide `hasText` is a case-insensitive
	// substring match, so the short edit name ("Ever") would also hit any member/contact/tag that merely
	// contains it (e.g. an employee called "Everett" or "Beverly") and fail although the project is gone.
	const page = getPage();
	await page.locator(OrganizationProjectsPage.verifyProjectCss).first().waitFor({ state: 'visible', timeout: 24_000 });
	const escaped = String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const exact = new RegExp('^\\s*' + escaped + '\\s*$');
	await expect(page.locator(OrganizationProjectsPage.projectNameCellCss).filter({ hasText: exact })).toHaveCount(0, {
		timeout: 24_000
	});
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationProjectsPage.toastrMessageCss);
};

export const clickSaveProjectButtonWithIndex = async (index: number) => {
	await clickButtonByIndex(OrganizationProjectsPage.saveProjectButtonCss, index);
};
