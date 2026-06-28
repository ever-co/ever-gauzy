import { expect } from '@playwright/test';
import { verifyElementIsVisible, clickButton, verifyText } from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { RolesPermissionsPage } from '../../../src/support/Base/pageobjects/RolesPermissionsPageObject';

export const rolesDropdownVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.rolesDropdownCss);
};

export const clickRolesDropdown = async () => {
	await clickButton(RolesPermissionsPage.rolesDropdownCss);
};

export const rolesDropdownOptionVisible = async () => {
	await verifyElementIsVisible(RolesPermissionsPage.dropdownOptionCss);
};

export const selectRoleFromDropdown = async (text: string) => {
	// The nbAutocomplete options render the raw role enum value (e.g. "SUPER_ADMIN"), not the
	// friendly label ("Super Admin") the pagedata supplies. Normalise label -> enum before matching:
	// uppercase + spaces to underscores ("Super Admin" -> "SUPER_ADMIN", "Data Entry" -> "DATA_ENTRY").
	const roleEnum = text.trim().toUpperCase().replace(/\s+/g, '_');
	// EXACT-text match (not the substring filter clickElementByText uses): "ADMIN" is a substring of
	// "SUPER_ADMIN", so a hasText:'ADMIN' filter matches BOTH options and .first() could pick the wrong
	// one depending on the (order-dependent) roles list. Anchoring on the whole trimmed option text
	// makes role selection order-independent and lets the ADMIN step use this helper instead of an index.
	await getPage()
		.locator(RolesPermissionsPage.dropdownOptionCss)
		.filter({ hasText: new RegExp(`^\\s*${roleEnum}\\s*$`) })
		.first()
		.click({ force: true });
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
 * Assert the checked state of the permission toggle at `index` WITHIN the given card.
 *
 * Replaces the old absolute-index verifyState: the toggle catalog (PermissionGroups in
 * @gauzy/contracts) grew/reordered well past the spec's hard-coded 0..84 map, and the screen renders
 * two cards, so a single running index across both is no longer meaningful. Indexing within each card
 * (GENERAL then ADMINISTRATION) tracks the live, ordered toggle lists. `state` is the cypress-style
 * fragment 'be.checked' / 'not.checked'. The toggles are decorative <input> elements (disabled for
 * read-only roles), so we assert their checked property directly.
 */
export const verifyStateInCard = async (card: 'general' | 'admin', index: number, state: string) => {
	const input = cardBody(card).locator(RolesPermissionsPage.cardInputCss).nth(index);
	if (state.includes('not')) {
		await expect(input).not.toBeChecked();
	} else {
		await expect(input).toBeChecked();
	}
};
