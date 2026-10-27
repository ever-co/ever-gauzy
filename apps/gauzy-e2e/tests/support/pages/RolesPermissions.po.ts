import { expect } from '@playwright/test';
import { verifyElementIsVisible, clickButton, verifyText } from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RolesPermissionsPage } from '../../../src/support/Base/pageobjects/RolesPermissionsPageObject';

export const rolesDropdownVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.rolesDropdownCss);
};

export const clickRolesDropdown = async () => {
	// Open the nbAutocomplete overlay. A single force-click can be swallowed by the previous role's
	// fading option-list backdrop on the 2nd..Nth open, leaving the panel shut so the following
	// rolesDropdownOptionVisible times out. Focus the input and nudge it (click + ArrowDown) so the
	// autocomplete reliably (re)opens and repaints its option list for the next selection.
	const input = getPage().locator(RolesPermissionsPage.rolesDropdownCss).first();
	await input.focus().catch(() => undefined);
	await clickButton(RolesPermissionsPage.rolesDropdownCss);
	await getPage().keyboard.press('ArrowDown').catch(() => undefined);
	await getPage().waitForTimeout(300);
};

export const rolesDropdownOptionVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.dropdownOptionCss);
};

export const selectRoleFromDropdown = async (text: string) => {
	// The nbAutocomplete options render the raw role enum value (e.g. "SUPER_ADMIN"), not the
	// friendly label ("Super Admin") the pagedata supplies. Normalise label -> enum before matching:
	// uppercase + spaces to underscores ("Super Admin" -> "SUPER_ADMIN", "Data Entry" -> "DATA_ENTRY").
	const roleEnum = text.trim().toUpperCase().replace(/\s+/g, '_');
	const page = getPage();
	// EXACT-text match (not the substring filter clickElementByText uses): "ADMIN" is a substring of
	// "SUPER_ADMIN", so a hasText:'ADMIN' filter matches BOTH options and .first() could pick the wrong
	// one depending on the (order-dependent) roles list. Anchoring on the whole trimmed option text
	// makes role selection order-independent and lets the ADMIN step use this helper instead of an index.
	const option = page
		.locator(RolesPermissionsPage.dropdownOptionCss)
		.filter({ hasText: new RegExp(`^\\s*${roleEnum}\\s*$`) })
		.first();
	const input = page.locator(RolesPermissionsPage.rolesDropdownCss).first();

	// ROUND-7 ROOT CAUSE: the previous `.click({ force: true })` on the nb-option was a COORDINATE click.
	// The nb-autocomplete overlay carries its own fading cdk backdrop, and a coordinate click — even
	// {force:true} — lands on that backdrop, so the option's (selectedChange) never fires, onSelectionChange()
	// never runs, and the ROLE NEVER SWITCHES. The screen stays on the previous role (EMPLOYEE is the default),
	// whose TEAM_DASHBOARD toggle is unchecked -> the very first verifyStateInCard('general', 1, checked) for
	// SUPER_ADMIN timed out. Fix: dispatch the click straight to the option element (mirrors the proven
	// TimeOff.selectTimeOffPolicy pattern) so selectedChange fires regardless of the backdrop. Then CONFIRM the
	// switch registered by polling the input's value, re-dispatching once if it hasn't taken effect yet.
	for (let attempt = 0; attempt < 3; attempt++) {
		await option.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
		await option.dispatchEvent('click').catch(() => option.click({ force: true }).catch(() => undefined));
		// Selecting a role fires permissions$ -> loading=true (spinner) -> loadPermissions() -> loading=false.
		// Wait out that reload cycle so the freshly-fetched permissions are rendered before we assert state.
		await page.waitForTimeout(400);
		const value = await input.inputValue().catch(() => '');
		if (value.trim() === roleEnum) return;
		// Not switched yet (backdrop swallowed it / options still settling): re-open the autocomplete and retry.
		await input.focus().catch(() => undefined);
		await page.keyboard.press('ArrowDown').catch(() => undefined);
		await page.waitForTimeout(300);
	}
};

export const generalSettingsCardVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.cardBodyCss);
};

export const verifyTextExist = async (text: string) => {
	await verifyText(RolesPermissionsPage.textCss, text);
};

/**
 * The permission card body for a group: nth(0) = GENERAL, nth(1) = ADMINISTRATION
 * (document order from roles-permissions.component.html).
 */
const cardBody = (card: 'general' | 'admin') =>
	getPage()
		.locator(RolesPermissionsPage.cardBodyContainerCss)
		.nth(card === 'general' ? 0 : 1);

/**
 * Wait until the GENERAL card has rendered its toggles for the freshly-selected role. Switching role
 * re-fetches role permissions (loadPermissions) behind an nb-spinner; the inputs from the previous
 * role can linger for a tick, so settle on a stable, non-zero toggle count before asserting state.
 */
export const waitForPermissionsLoaded = async () => {
	// Let the getRolePermissions XHR for the freshly-selected role settle, then wait out the reload
	// spinner. The toggle COUNT is constant across roles (it is the catalog size, not the role's
	// permissions), so a count-only poll can pass on the PREVIOUS role's still-rendered inputs; the
	// card comparison in the steps (readCardToggles, re-read for up to 30s) is what actually converges
	// once loadPermissions() has repainted enabledPermissions for the new role.
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage()
		.locator('nb-spinner')
		.first()
		.waitFor({ state: 'detached', timeout: 8_000 })
		.catch(() => {});
	await expect
		.poll(async () => cardBody('general').locator(RolesPermissionsPage.cardInputCss).count(), { timeout: 24_000 })
		.toBeGreaterThan(0);
};

/**
 * Every permission toggle of a card, in DOM order: the label it renders and whether it is checked.
 *
 * Read in one pass so the caller can tie each toggle to its permission by label — since the
 * roles & permissions polish (#10526) the toggles are grouped into titled sections, so their position
 * no longer follows PermissionGroups — and compare the whole card at once, re-reading until the
 * freshly selected role's permissions have been painted. The `<input>` is decorative (disabled for a
 * read-only role), so its `checked` property is the state.
 */
export const readCardToggles = async (card: 'general' | 'admin'): Promise<{ label: string; checked: boolean }[]> =>
	cardBody(card)
		.locator('nb-toggle')
		.evaluateAll((toggles) =>
			toggles.map((toggle) => ({
				label: (toggle.querySelector('.custom-permission-view strong')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
				checked: !!(toggle.querySelector('input.native-input') as HTMLInputElement | null)?.checked
			}))
		);
