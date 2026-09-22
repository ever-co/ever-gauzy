import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	verifyText,
	verifyTextNotExisting,
	waitElementToHide,
	waitForSpinnerGone,
	dispatchClick,
	getLastElement
} from '../util';
import { selectNgOption } from '../ng-select';
import { expect } from '@playwright/test';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationDepartmentsPage } from '../../../src/support/Base/pageobjects/OrganizationDepartmentsPageObject';

// The "Add Tags" overlay (from CustomCommands.addTag) and the department Add/Edit form's own
// modal leave an active cdk-overlay-backdrop that intercepts every click. Press Escape until
// that backdrop is gone.
const dismissOpenDialog = async () => {
	const page = getPage();
	const backdrop = page.locator('.cdk-overlay-backdrop');
	for (let i = 0; i < 4; i++) {
		if ((await backdrop.count()) === 0) break;
		await page.keyboard.press('Escape');
		await page.waitForTimeout(600);
	}
};

const settleBeforeAdd = async () => {
	const page = getPage();
	await dismissOpenDialog();
	const toast = page.locator(OrganizationDepartmentsPage.toastrMessageCss);
	try {
		await toast.first().waitFor({ state: 'hidden', timeout: 12000 });
	} catch {
		/* no toast present */
	}
	await page.waitForTimeout(500);
};

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addDepartmentButtonVisible = async () => {
	await settleBeforeAdd();
	await verifyElementIsVisible(OrganizationDepartmentsPage.addDepartmentButtonCss);
};

export const clickAddDepartmentButton = async () => {
	// dispatchClick: CustomCommands.addTag just closed a dialog, and the route fade leaves a transient
	// cdk backdrop over the toolbar that a coordinate click lands on; dispatch fires openDialog() so the
	// add dialog reliably opens.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationDepartmentsPage.addDepartmentButtonCss);
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.nameInputCss);
};

export const enterNameInputData = async (data: string) => {
	await clearField(OrganizationDepartmentsPage.nameInputCss);
	await enterInput(OrganizationDepartmentsPage.nameInputCss, data);
};

export const selectEmployeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.selectEmployeeDropdownCss);
};

export const clickEmployeeDropdown = async () => {
	// Wait out the full-card nb-spinner first (the mutation card shows one while it loads its async
	// data); it overlays the nb-select, so a coordinate click would land on the spinner. The employee
	// list is an nb-select (opens on click) whose options are the org employees loaded async.
	await waitForSpinnerGone();
	await clickButton(OrganizationDepartmentsPage.selectEmployeeDropdownCss);
};

/**
 * Collapse the members nb-select's option panel.
 *
 * ga-employee-multi-select is `<nb-select [multiple]>`, and a MULTIPLE nb-select deliberately keeps its
 * panel open after a selection so you can pick more. That panel is a cdk overlay hanging BELOW the
 * control — i.e. straight over the dialog footer where Save lives. Every click in this page object is
 * `force: true`, which skips the "receives events" check but still delivers the click at screen
 * coordinates, so the Save click was being handed to the option list instead of the button: no submit,
 * no POST, no toast, the dialog just sat there and verifyDepartmentExists timed out on an empty grid.
 *
 * It only bites once the organization has enough employees for the panel to reach the footer, which is
 * exactly why this passed on a fresh database and started failing after the specs that add employees
 * had run. Closing the panel is the fix; do it by DISPATCHING the toggle click (a coordinate click can
 * itself be swallowed by the panel we are trying to close) and confirm via nb-select's own `open` class.
 *
 * Escape is not an option here: nb-dialog opens with closeOnEsc, so it closes the whole Add form.
 */
const closeEmployeeDropdown = async () => {
	const page = getPage();
	// Target whichever nb-select is currently OPEN: nb-select puts an `open` class on its host while the
	// panel is up, so this needs no assumption about the control's caption (which changes as soon as
	// employees are picked) or about the dialog still being mounted.
	const openSelect = page.locator('nb-select.open');
	for (let attempt = 0; attempt < 5; attempt++) {
		if ((await openSelect.count().catch(() => 0)) === 0) return;
		await openSelect
			.first()
			.locator('button.select-button')
			.first()
			.dispatchEvent('click')
			.catch(() => {});
		await page.waitForTimeout(400);
	}
};

export const selectEmployeeFromDropdown = async (index: number) => {
	// Best-effort employee pick (mirrors ContactsLeads.selectEmployeeDropdownOption): the nb-option
	// list loads async and can legitimately be EMPTY (no employee "working" in the header date range).
	// Select one if it shows within ~8s; otherwise press Escape and continue — members are optional and
	// the department saves fine without them. Avoids a hard taskTimeout (60s) hang on an empty list.
	const page = getPage();
	const option = page.locator(OrganizationDepartmentsPage.selectEmployeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
		// A multiple nb-select keeps its panel open over the footer — collapse it before moving on.
		await closeEmployeeDropdown();
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const tagsDropdownVisible = async () => {
	// addTagsDropdownCss is scoped to ga-departments-mutation, so this is the in-dialog Tags ng-select.
	await getPage()
		.locator(OrganizationDepartmentsPage.addTagsDropdownCss)
		.last()
		.waitFor({ state: 'visible', timeout: 24000 });
};

export const clickTagsDropdown = async () => {
	// ga-tags-color-input is an <ng-select> (opens on MOUSEDOWN). A coordinate force-click on the control
	// is backdrop-blocked by the leftover addTag overlay AND can toggle the panel shut again, so open it
	// via the keyboard: focus the search input and press ArrowDown.
	const page = getPage();
	const input = page.locator(OrganizationDepartmentsPage.addTagsDropdownCss).last().locator('input').first();
	await input.focus().catch(() => {});
	await page.keyboard.press('ArrowDown');
};

export const selectTagFromDropdown = async (index: number) => {
	// Routed through the ONE shared ng-select driver (tests/support/ng-select.ts). It counts only REAL
	// options: a bare `div.ng-option` ALSO matches ng-select's disabled "No items found" / "Loading…"
	// rows, so the old wait-then-click was satisfied by an EMPTY list and then clicked a row ng-select
	// ignores — a silent no-op that left this field unset. It re-opens the panel via the control's own
	// container until real options render (NEVER Escape: nb-dialog opens with closeOnEsc and that closed
	// the whole form), and it confirms the pick against `div.ng-value`, the only node that exists once a
	// value is really bound. Still best-effort — the tag is optional here — but it can no longer
	// half-succeed, and it can no longer kill the dialog on a slow list.
	await selectNgOption(OrganizationDepartmentsPage.addTagsDropdownCss, OrganizationDepartmentsPage.tagsDropdownOption, index);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async () => {
	await clickButton(OrganizationDepartmentsPage.footerCss);
};

export const saveDepartmentButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.saveDepartmentButtonCss);
};

export const clickSaveDepartmentButton = async () => {
	// IMPORTANT: this Save button is type="submit" with NO (click) handler — it submits the form via the
	// native submit -> (ngSubmit). A synthetic dispatchEvent('click') is an UNtrusted event and does NOT
	// trigger native form submission, so it would silently no-op. It has to be a real coordinate click,
	// which means nothing may be painted on top of it: `force: true` skips the actionability CHECK but
	// still delivers the click wherever the pointer is, so an overlay lying over the button eats the
	// submit silently. Collapse the option panels first, then click and PROVE it landed — the dialog
	// closes on a successful save (departments.component._clearItem), so a dialog that is still there
	// means the submit never happened, and we close panels and try once more.
	const page = getPage();
	const dialog = page.locator('ga-departments-mutation');
	for (let attempt = 0; attempt < 2; attempt++) {
		await waitForSpinnerGone();
		await closeEmployeeDropdown();
		await page
			.locator(OrganizationDepartmentsPage.tagsDropdownOption)
			.first()
			.waitFor({ state: 'hidden', timeout: 2000 })
			.catch(() => {});
		await clickButton(OrganizationDepartmentsPage.saveDepartmentButtonCss);
		try {
			await dialog.first().waitFor({ state: 'detached', timeout: 8000 });
			return;
		} catch {
			/* still open -> the click did not submit; re-close panels and retry once */
		}
	}
};

export const tableRowVisible = async () => {
	// The Add/Edit form's modal backdrop can linger over the list and swallow the row click.
	await dismissOpenDialog();
	await getPage()
		.locator(OrganizationDepartmentsPage.selectTableRowCss)
		.first()
		.waitFor({ state: 'visible', timeout: 24000 });
};

export const selectTableRow = async () => {
	const page = getPage();
	await dismissOpenDialog();
	// Click the first cell (plain name text) — clicking the whole row can land on a link cell
	// (e.g. the employee avatar link) and navigate away instead of selecting.
	const cell = page.locator(OrganizationDepartmentsPage.selectTableRowCss).last().locator('td').first();
	const editBtn = page.locator(OrganizationDepartmentsPage.editDepartmentButtonCss).first();
	for (let i = 0; i < 3; i++) {
		if (await editBtn.isEnabled().catch(() => false)) return;
		await cell.click({ force: true });
		await page.waitForTimeout(800);
	}
};

// Select the specific department row by its (unique) name so edit/delete target exactly the
// department this run created, even when prior runs left similarly-named rows behind.
export const selectRowByText = async (text: string) => {
	const page = getPage();
	await dismissOpenDialog();
	// Let the grid settle: after the preceding add/edit mutation it re-renders/refetches (departments$
	// debounce + _clearItem), and a click during that window is lost or immediately cleared. Settle,
	// then click the name cell ONCE per pass and poll the real `disabled` attr — clicking the row
	// TOGGLES selection, so only re-click if the first click was lost to a late re-render.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page
		.locator(OrganizationDepartmentsPage.selectTableRowCss)
		.filter({ hasText: text })
		.first();
	await row.waitFor({ state: 'visible', timeout: 24000 });
	// Click the first (name) cell — the whole-row click can hit a link cell and navigate away.
	const cell = row.locator('td').first();
	const editBtn = page.locator(OrganizationDepartmentsPage.editDepartmentButtonCss).first();
	for (let i = 0; i < 4; i++) {
		await cell.click({ force: true });
		for (let j = 0; j < 8; j++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const clickEditButton = async () => {
	// dispatchClick: a just-closed add/save dialog leaves a fading cdk backdrop over the toolbar that
	// swallows a coordinate click on Edit; dispatch fires openDialog() directly.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationDepartmentsPage.editDepartmentButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.deleteDepartmentButtonCss);
};

export const clickDeleteButton = async () => {
	// dispatchClick: the preceding edit-save dialog leaves a fading backdrop over the toolbar; dispatch
	// fires removeDepartment() (which opens the confirmation dialog) directly.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationDepartmentsPage.deleteDepartmentButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// dispatchClick: fire the confirmation dialog's OK directly so a lingering backdrop can't swallow it
	// and leave the dialog open (which would keep the row in the grid and fail the deletion assertion).
	await waitForSpinnerGone();
	await dispatchClick(OrganizationDepartmentsPage.confirmDeleteButtonCss);
};

export const verifyDepartmentExists = async (text: string) => {
	// Many cells match verifyDepartmentCss; target the one holding our department name.
	await getPage()
		.locator(OrganizationDepartmentsPage.verifyDepartmentCss, { hasText: text })
		.first()
		.waitFor({ state: 'visible', timeout: 24000 });
};

export const verifyDepartmentIsDeleted = async (text: string) => {
	// Only our (uniquely named) department cell should be gone; other rows may remain.
	await expect(
		getPage().locator(OrganizationDepartmentsPage.verifyDepartmentCss, { hasText: text })
	).toHaveCount(0, { timeout: 24000 });
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationDepartmentsPage.toastrMessageCss);
};
