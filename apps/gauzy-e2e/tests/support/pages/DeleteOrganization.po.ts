import { expect } from '@playwright/test';
import { verifyElementIsVisible, dispatchClick, waitForSpinnerGone } from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { DeleteOrganizationPage } from '../../../src/support/Base/pageobjects/DeleteOrganizationPageObject';

/**
 * Organizations this spec must NEVER delete.
 *
 * The original flow selected grid row 0 and deleted it. On the current seed that row is
 * `Default Company` — the organization every other spec runs against. Deleting it cascades away the
 * admin's user_organization row (subsequent requests 401, and the token refresh comes back with
 * organizationId:null) and the seeded time-off policy, which took out seven downstream specs in a
 * single run. This is NOT a local-DB artefact: on ANY database, including a fresh CI seed, "row 0" is
 * whatever happens to sort first, so the spec was one seed-ordering change away from doing the same
 * thing in CI. It now creates its own throwaway organization and deletes THAT by name; this list is
 * the backstop that refuses to delete a seeded organization if the lookup ever goes wrong.
 */
const PROTECTED_ORGANIZATIONS = ['Default Company'];

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number = 1) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const deleteBtnExists = async () => {
	await verifyElementIsVisible(DeleteOrganizationPage.deleteButtonCss);
};

// The toolbar Delete button is [disabled] until a grid row is selected (Angular doesn't fire (click)
// on a disabled control, so clicking it early is a silent no-op and the confirm dialog never opens).
// Callers select the target row by name first via selectOrganization, which polls the button's real
// `disabled` attribute until the selection has registered.
export const deleteBtnClick = async () => {
	// dispatchClick fires the handler even if a fading cdk-overlay backdrop sits on top.
	await dispatchClick(DeleteOrganizationPage.deleteButtonCss);
};

export const confirmBtnExists = async () => {
	await verifyElementIsVisible(DeleteOrganizationPage.confirmDeleteCss);
};

// Confirm OK is clicked right after the dialog opens; a fading backdrop can intercept a coordinate
// click — use dispatchClick so the (click)->delete() handler fires regardless.
export const confirmBtnClick = async () => {
	await dispatchClick(DeleteOrganizationPage.confirmDeleteCss);
};

const nameFilterInput = () => getPage().locator(DeleteOrganizationPage.nameFilterInputCss).first();

/**
 * Narrow the grid via the Name column filter. `term` should be a short unique token, not a whole
 * company name (see the step file) — the filter is a substring match, so a token is enough.
 *
 * angular2-smart-table's InputFilterComponent is
 *   `<input [value]="query" (change)="onValueChanged(...)" (keyup)="onValueChanged(...)">`
 * — it reacts to keyup/change, never to 'input', and the debounced refetch writes `query` straight
 * back into [value]. Typing character by character therefore races the write-back and leaves a
 * mangled value — a 27-character company name came out with 9 characters missing and matched nothing.
 * Set the whole value in one shot with fill() and then dispatch the 'change' the component listens
 * for: atomic, so there is no window for the write-back to eat characters.
 */
export const searchOrganizationByName = async (term: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await expect(nameFilterInput()).toBeVisible({ timeout: 24_000 });

	for (let attempt = 0; attempt < 4; attempt++) {
		const input = nameFilterInput();
		await input.fill(String(term)).catch(() => {});
		await input.dispatchEvent('change').catch(() => {});
		// Filtering is debounced; let the grid repaint before reading the value back.
		await page.waitForTimeout(1200);
		await waitForSpinnerGone();
		const current = await nameFilterInput()
			.inputValue()
			.catch(() => '');
		if (current === String(term)) return;
	}
};

/**
 * Select the grid row for `name` so the toolbar Delete button becomes enabled.
 *
 * Row click TOGGLES selection, so this clicks ONCE and then polls the Delete button's real `disabled`
 * attribute, only re-clicking if the selection did not register (a rapid second click would deselect
 * it again). Before clicking it reads the row back and refuses to proceed if the row belongs to a
 * seeded organization — see PROTECTED_ORGANIZATIONS.
 */
export const selectOrganizationRow = async (name: string) => {
	const page = getPage();
	const deleteBtn = page.locator(DeleteOrganizationPage.deleteButtonCss).first();

	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);

	const row = page.locator(DeleteOrganizationPage.selectOrganization).filter({ hasText: name }).first();
	await row.waitFor({ state: 'visible', timeout: 24_000 });

	const rowText = ((await row.textContent()) || '').replace(/\s+/g, ' ').trim();
	const seeded = PROTECTED_ORGANIZATIONS.find((organization) => rowText.includes(organization));
	if (seeded) {
		throw new Error(
			`Refusing to delete the seeded organization "${seeded}" (matched row: "${rowText}"). This spec ` +
				`must only delete the throwaway organization it creates itself — deleting the seeded ` +
				`organization cascades away the admin's membership and the seeded time-off policy, and breaks ` +
				`every spec that runs after it.`
		);
	}

	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let poll = 0; poll < 8; poll++) {
			if ((await deleteBtn.getAttribute('disabled')) === null) return; // enabled -> selection registered
			await page.waitForTimeout(350);
		}
	}
};

// Back-compat: the step file reads better with the shorter name.
export const selectOrganization = async (name: string) => {
	await selectOrganizationRow(name);
};

/** The grid is still filtered to `name`, so a successful delete leaves it with zero data rows. */
export const verifyOrganizationDeleted = async (name: string) => {
	const page = getPage();
	await waitForSpinnerGone();
	await expect(page.locator(DeleteOrganizationPage.selectOrganization).filter({ hasText: name })).toHaveCount(0, {
		timeout: 24_000
	});
};
