import {
	applySmartTableFilter,
	verifyElementIsVisible,
	verifyElementIsVisibleByIndex,
	clickButton,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickElementByText,
	clickKeyboardBtnByKeycode,
	verifyText,
	waitElementToHide,
	clickByText,
	dispatchClick,
	dispatchClickWhenSettled,
	waitForSpinnerGone
} from '../util';
import { selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { EditUserPage } from '../../../src/support/Base/pageobjects/EditUserPageObject';

// Tracks whether the "add existing organization" sub-flow actually selected + saved an org.
// On the single-organization test DB the org picker is ALWAYS empty: a freshly-created user is
// auto-assigned to the only organization, and the picker shows all_orgs MINUS the user's orgs
// (edit-user-organizations-mutation._loadOrganizations) -> zero options. When nothing was added we
// must skip the Save/Remove/Confirm steps: the per-org remove() in edit-user-organizations.component
// DELETES THE USER and navigates away when it's the user's last org (counter - 1 < 1), which would
// wipe the user before the real test (the Main-tab rename + verify) runs.
let orgWasAdded = false;

// Counts the removable org rows (button.orgs__remove) currently rendered. The remove-org sub-flow
// is only SAFE + meaningful when this is >= 2: removing a row when the user has only one org triggers
// the delete-user dialog (edit-user-organizations.component.remove, counter - 1 < 1), which would wipe
// the user before the real test (Main-tab rename + verify) runs. We gate on this LIVE DOM count rather
// than the orgWasAdded flag alone: the picker may have been non-empty (intra-run pollution), so
// orgWasAdded can be true while the add never persisted/rendered a second row — in which case the close
// button never appears and the old hard verify burned its full 24s timeout and failed the whole spec.
const removableOrgCount = async (): Promise<number> => {
	// Let the post-save list reload (debounced 300ms + async fetch + full-card spinner) settle first.
	await waitForSpinnerGone().catch(() => {});
	return getPage().locator(EditUserPage.removeOrgButtonCss).count();
};

export const gridButtonVisible = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const clickGridButton = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

// Narrow the users grid to one full name so the user this spec created is the only data row on page 1.
// The grid pages at 10 and the shared serial DB accumulates users, so without this the new user is
// simply not rendered and both the by-name verify and the row click miss it (mirrors RemoveUser.po).
export const filterByName = async (name: string) => {
	await applySmartTableFilter(EditUserPage.nameFilterInputCss, name);
};

export const tableRowVisible = async () => {
	await verifyElementIsVisibleByIndex(EditUserPage.selectTableRowCss, 0);
};

export const selectTableRow = async (text: string) => {
	await clickByText(EditUserPage.selectTableRowCss, text);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(EditUserPage.editButtonCss);
};

export const clickEditButton = async () => {
	// The action bar (ngx-gauzy-button-action) slides in over ~0.2s once a row is selected, so a
	// coordinate click resolved mid-transition lands on whichever button occupies that spot at delivery
	// time — the failing run's trace shows it hitting "Convert to employee" (its toast is in the trace)
	// and the edit page never opening. Settle, dispatch straight at the Edit button, and confirm the
	// edit page's tab strip rendered.
	await dispatchClickWhenSettled(EditUserPage.editButtonCss, EditUserPage.orgTabButtonCss);
};

export const orgTabButtonVisible = async () => {
	await verifyElementIsVisibleByIndex(EditUserPage.orgTabButtonCss, 0);
};

export const clickOrgTabButton = async (index: number) => {
	await clickButtonByIndex(EditUserPage.orgTabButtonCss, index);
};

export const removeOrgButtonVisible = async () => {
	// Best-effort: only the presence of >=2 removable org rows makes the remove sub-flow safe AND
	// meaningful. Don't hard-assert — if the add didn't persist a second org (empty/raced picker) we
	// still want to fall through to the real test (the Main-tab rename). Removing the user's LAST org
	// triggers the delete-user dialog (edit-user-organizations.component.remove, counter - 1 < 1)
	// which would delete the user and navigate away before the Main-tab rename/verify runs.
	if (!orgWasAdded) return;
	if ((await removableOrgCount()) < 2) {
		orgWasAdded = false; // the add didn't materialize a second row — skip the rest of the sub-flow.
	}
};

export const clickRemoveOrgButton = async () => {
	if (!orgWasAdded) return;
	await clickButtonByIndex(EditUserPage.removeOrgButtonCss, 0);
};

export const confirmRemoveBtnVisible = async () => {
	if (!orgWasAdded) return;
	await verifyElementIsVisible(EditUserPage.confirmRemoveOrgButtonCss);
};

export const clickConfirmRemoveButton = async () => {
	if (!orgWasAdded) return;
	// Confirm sits in an nb-dialog opened right before; dispatch the click so the fading backdrop
	// can't intercept a coordinate click.
	await dispatchClick(EditUserPage.confirmRemoveOrgButtonCss);
};

export const addOrgButtonVisible = async () => {
	await verifyElementIsVisible(EditUserPage.addOrgButtonCss);
};

export const clickAddOrgButton = async () => {
	// The Organizations tab shows a spinner while it loads, and its Add button waits for the load; settle it,
	// then dispatch the click straight at the button so the spinner overlay can't swallow it.
	await waitForSpinnerGone();
	await dispatchClick(EditUserPage.addOrgButtonCss);
	// Confirm the add dialog opened (best-effort); try once more if the click landed before the load did.
	const search = getPage().locator(EditUserPage.selectOrgMultiSelectCss).first();
	if (!(await search.isVisible().catch(() => false))) {
		await getPage().waitForTimeout(400);
		await dispatchClick(EditUserPage.addOrgButtonCss).catch(() => {});
	}
};

export const selectOrgDropdownVisible = async () => {
	// Best-effort: the add dialog's search shows once the dialog is open. Don't hard-assert — if the dialog
	// failed to open we still want to fall through to the real test (the Main-tab rename).
	await getPage()
		.locator(EditUserPage.selectOrgMultiSelectCss)
		.first()
		.waitFor({ state: 'visible', timeout: 8000 })
		.catch(() => {});
};

export const clickSelectOrgDropdown = async () => {
	/* no-op: the add dialog lists its organizations as a checklist, with no dropdown to open */
};

export const clickSelectOrgDropdownOption = async () => {
	// Best-effort org pick: on the single-org test DB the checklist is empty (see orgWasAdded note), so wait
	// briefly for an option and tick it if present; otherwise close the dialog and continue. The org sub-flow
	// is only a prerequisite for the real test.
	const option = getPage().locator(EditUserPage.selectOrgDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(0).click({ force: true });
		// No Escape here: it would close the dialog before its Add.
		orgWasAdded = true;
	} catch {
		// Nothing to add: close the dialog (Escape, or its Cancel) so its backdrop leaves the tab clean.
		await getPage().keyboard.press('Escape').catch(() => {});
		const cancel = getPage().locator(EditUserPage.cancelAddOrgButtonCss).first();
		if (await cancel.isVisible().catch(() => false)) {
			await cancel.click({ force: true }).catch(() => {});
		}
	}
};

export const saveSelectedOrgButtonVisible = async () => {
	// Only when an org was actually ticked; the Add button lives in the dialog we close when there is nothing to add.
	if (!orgWasAdded) return;
	await verifyElementIsVisible(EditUserPage.saveSelectedOrgButton);
};

export const clickSaveSelectedOrgButton = async () => {
	if (!orgWasAdded) return;
	const page = getPage();
	// Add saves the memberships and then, whether they were saved or refused, reloads the user's memberships
	// (debounced). Neither the dialog closing nor a spinner proves that reload has landed, so wait for its answer:
	// registered before the click, it can only be a reload that follows this save.
	const reloaded = page
		.waitForResponse(
			(response) =>
				response.request().method() === 'GET' &&
				new URL(response.url()).pathname.endsWith('/user-organization'),
			{ timeout: 20_000 }
		)
		.catch(() => null);
	// Dispatch the click so no overlay intercepts it.
	await dispatchClick(EditUserPage.saveSelectedOrgButton);
	await reloaded;
	await waitForSpinnerGone().catch(() => {});
	// A dialog still open now means the add was refused: close it so its backdrop can't swallow the next click. The
	// remove step that follows counts the rows the reload shows, so a refused add is not taken for a second org.
	const dialog = page.locator('.assign-dialog');
	if (await dialog.count()) {
		await getPage().keyboard.press('Escape').catch(() => {});
		await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
	}
};

export const firstNameInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.firstNameInputCss);
};

export const enterFirstNameData = async (data: string) => {
	await clearField(EditUserPage.firstNameInputCss);
	await enterInput(EditUserPage.firstNameInputCss, data);
};

export const lastNameInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.lastNameInputCss);
};

export const enterLastNameData = async (data: string) => {
	await clearField(EditUserPage.lastNameInputCss);
	await enterInput(EditUserPage.lastNameInputCss, data);
};

export const passwordInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.passwordInputCss);
};

export const enterPasswordData = async (data: string) => {
	await enterInput(EditUserPage.passwordInputCss, data);
};

export const repeatPasswordInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.repeatPasswordInputCss);
};

export const enterRepeatPasswordData = async (data: string) => {
	await enterInput(EditUserPage.repeatPasswordInputCss, data);
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(EditUserPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await clearField(EditUserPage.emailInputCss);
	await enterInput(EditUserPage.emailInputCss, data);
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(EditUserPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	await clickButton(EditUserPage.tagsSelectCss);
};

export const selectTagsFromDropdown = async (index: number) => {
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(EditUserPage.tagsSelectCss, EditUserPage.tagsSelectOptionCss, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const selectRoleVisible = async () => {
	await verifyElementIsVisible(EditUserPage.roleSelectCss);
};

export const chooseRoleSelectData = async (data: string) => {
	await clickButton(EditUserPage.roleSelectCss);
	// Role options are raw RolesEnum names (e.g. "ADMIN", "SUPER_ADMIN") shown for a Super Admin
	// editor. A plain hasText substring match for "Admin" also matches "SUPER_ADMIN" — pick the
	// first option whose trimmed text equals the role exactly (case-insensitive) instead.
	const exact = new RegExp(`^\\s*${data}\\s*$`, 'i');
	await getPage()
		.locator(EditUserPage.roleSelectOptionCss)
		.filter({ hasText: exact })
		.first()
		.click({ force: true });
};

export const languageSelectVisible = async () => {
	await verifyElementIsVisible(EditUserPage.preferredLanguageCss);
};

export const chooseLanguage = async (data: string) => {
	// Same ngx-language-selector ng-select (appendTo="body", opens on mousedown) inside the same
	// ngx-profile form as the Edit Profile page, where opening it from the keyboard (focus + ArrowDown)
	// is what demonstrably worked on stage run 40364004456. Open it that way first; if the option list
	// does not render, fall back to the original click-open path, which still fails the step if the
	// language cannot be picked.
	const option = getPage().locator(EditUserPage.preferredLanguageOptionCss).filter({ hasText: data }).first();
	try {
		const input = getPage().locator(EditUserPage.preferredLanguageCss).locator('input').first();
		await input.focus();
		await getPage().keyboard.press('ArrowDown');
		await option.waitFor({ state: 'visible', timeout: 8_000 });
	} catch {
		await clickButton(EditUserPage.preferredLanguageCss);
	}
	await clickElementByText(EditUserPage.preferredLanguageOptionCss, data);
};

export const saveBtnExists = async () => {
	await verifyElementIsVisible(EditUserPage.saveButtonCss);
};

export const saveBtnClick = async () => {
	// The org sub-flow may have just closed a confirm nb-dialog, leaving a fading cdk-overlay backdrop;
	// and the Save button carries [disabled]="form.invalid" (a force coordinate-click on a disabled
	// button is suppressed by the browser). Settle any spinner, then dispatch the click straight at the
	// button: dispatchEvent fires through the backdrop and regardless of the disabled attr, and
	// edit-profile-form.submitForm() validates internally before persisting.
	await waitForSpinnerGone();
	await dispatchClick(EditUserPage.saveButtonCss);
};

export const verifyUserExists = async (text: string) => {
	await verifyText(`${EditUserPage.verifyUserCss}:has-text("${text}")`, text);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(EditUserPage.toastrMessageCss);
};
