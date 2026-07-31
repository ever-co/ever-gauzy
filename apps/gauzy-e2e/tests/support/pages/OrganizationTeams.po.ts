import {
	verifyElementIsVisible,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	scopeGridTo,
	clickAndAwaitDialogClose,
	waitForSpinnerGone
} from '../util';
import { selectNgOption } from '../ng-select';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { OrganizationTeamsPage } from '../../../src/support/Base/pageobjects/OrganizationTeamsPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addTeamButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.addTeamButtonCss);
};

export const clickAddTeamButton = async () => {
	// Clicked right after the addTag prerequisite: a leftover/re-opened "Add Tags" nb-dialog can still
	// be mounted with its cdk backdrop intercepting the toolbar "Add" so ga-teams-mutation never opens.
	// Dismiss any leftover tags dialog, dispatch the Add click (bypasses the fading backdrop), then
	// confirm the team mutation form opened — retry the click once if it didn't.
	const page = getPage();
	for (let i = 0; i < 3 && (await page.locator('ngx-tags-mutation').count()) > 0; i++) {
		await page.keyboard.press('Escape').catch(() => undefined);
		await page.locator('ngx-tags-mutation').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => undefined);
	}
	await waitForSpinnerGone();
	await dispatchClick(OrganizationTeamsPage.addTeamButtonCss);
	const mutation = page.locator('ga-teams-mutation');
	const opened = await mutation
		.first()
		.waitFor({ state: 'visible', timeout: 8000 })
		.then(() => true)
		.catch(() => false);
	if (!opened) {
		await dispatchClick(OrganizationTeamsPage.addTeamButtonCss);
	}
};

export const nameInputVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.teamNameInputCss);
};

export const enterNameInputData = async (data: string) => {
	// Target the CURRENT (topmost) mutation dialog. clearField/enterInput are strict, so if a previous
	// dialog is somehow still mounted this threw "strict mode violation: … resolved to 2 elements" — and
	// `.first()` would have been worse, quietly typing into the dead dialog. `.last()` is the one the
	// user is looking at, and with a single dialog (the normal case) it is identical to today.
	const input = getPage().locator(OrganizationTeamsPage.teamNameInputCss).last();
	await input.clear();
	await input.fill(String(data));
};

export const tagsMultiSelectVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.tagsSelectCss);
};

export const clickTagsMultiSelect = async () => {
	// Tags is an ng-select (#addTags) — it opens on MOUSEDOWN and a force-click can land on the dialog
	// backdrop or even close the add form. Open it via keyboard instead (focus its inner input + ArrowDown).
	const input = getPage().locator(OrganizationTeamsPage.tagsSelectCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
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
	await selectNgOption(OrganizationTeamsPage.tagsSelectCss, OrganizationTeamsPage.tagsSelectOptionCss, index);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.employeeMultiSelectCss);
};

export const clickEmployeeDropdown = async (_index: number) => {
	// Members selector is a single nb-select (matched by its label text), so the index is ignored — open
	// the one match. Settle any transient form spinner first. The mutation form is an nb-dialog opened with
	// default config (closeOnBackdropClick:true): a coordinate {force:true} click that lands on the fading
	// cdk-overlay-backdrop (left by the just-closed tags ng-select panel) would CLOSE the whole dialog, so
	// dispatch the click straight to the nb-select host instead — it opens on the click event and never
	// touches the backdrop. The nb-select renders only after ga-employee-multi-select's @if (loaded) flips
	// true (its working-employees load resolves), so wait for it to attach before dispatching.
	await waitForSpinnerGone();
	await getPage()
		.locator(OrganizationTeamsPage.employeeMultiSelectCss)
		.first()
		.waitFor({ state: 'attached', timeout: 15000 })
		.catch(() => undefined);
	await dispatchClick(OrganizationTeamsPage.employeeMultiSelectCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	await pickEmployeeOption(index);
};

export const managerDropdownVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.managerMultiSelectCss);
};

export const clickManagerDropdown = async (_index: number) => {
	// Managers selector is a single nb-select (matched by its label text), so the index is ignored. Same
	// reasoning as clickEmployeeDropdown: wait for the nb-select to attach (renders only after @if (loaded)),
	// then dispatch the click so a fading backdrop can't close the nb-dialog.
	await waitForSpinnerGone();
	await getPage()
		.locator(OrganizationTeamsPage.managerMultiSelectCss)
		.first()
		.waitFor({ state: 'attached', timeout: 15000 })
		.catch(() => undefined);
	await dispatchClick(OrganizationTeamsPage.managerMultiSelectCss);
};

export const selectManagerFromDropdown = async (index: number) => {
	await pickEmployeeOption(index);
};

// Best-effort, IDEMPOTENT pick of an nb-select option (members/managers share '.option-list nb-option').
// The working employees list loads async; per the seed it should hold at least the admin, but keep this
// best-effort so a slow/empty list never hangs on a 60s click timeout.
// Two dialog-killing hazards handled here:
//  - closeOnEsc:true — the old `keyboard.press('Escape')` miss-fallback CLOSED THE WHOLE DIALOG (then Save
//    was never found, the observed failure). On miss we instead click the dialog title (neutral, inside
//    .editable) to dismiss only the option panel, keeping the team form open.
//  - multi-select TOGGLE — clicking an already-selected option DESELECTS it. In EDIT the form is pre-filled
//    with the created team's member/manager (both the admin), so re-clicking option 0 for BOTH would empty
//    member+manager and leave the form invalid (rename never saves). So only click when the option is NOT
//    already '.selected' — leaving an existing selection intact and adding one when there is none.
// The click is dispatched (not a coordinate click) so a fading backdrop can't redirect it onto the dialog
// backdrop and close the dialog.
const pickEmployeeOption = async (index: number) => {
	const page = getPage();
	const option = page.locator(OrganizationTeamsPage.selectDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		const target = option.nth(index);
		const cls = (await target.getAttribute('class')) || '';
		if (!/\bselected\b/.test(cls)) {
			await target.dispatchEvent('click');
		}
	} catch {
		// Close just the (possibly open) nb-select panel without Escape — never close the team dialog.
		await page
			.locator(OrganizationTeamsPage.cardBodyCss)
			.first()
			.click({ force: true })
			.catch(() => undefined);
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const clickCardBody = async (_index: number) => {
	// Dismiss an open ng-select / nb-select panel by clicking a neutral element INSIDE the dialog (the
	// form title). The old 'nb-card-body' target no longer exists in the flat ga-teams-mutation form and
	// the page card behind sits under a backdrop; Escape would close the whole nb-dialog.
	// dispatchClick (not a coordinate click): a just-closed nb-select option panel leaves a fading
	// cdk-overlay-backdrop over the dialog; a coordinate click({force:true}) on the title lands on
	// that backdrop, and the nb-dialog (closeOnBackdropClick:true) then closes the whole team form —
	// which is why the next Managers nb-select was never found. Dispatch straight to the title element
	// so the open panel is dismissed without the click ever reaching the backdrop.
	await dispatchClick(OrganizationTeamsPage.cardBodyCss).catch(() => undefined);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// PROVE the submit landed, instead of assuming it. Previously this dispatched one click and moved on;
	// when the click didn't submit (Save still disabled while memberIds — a required control — was being
	// bound, or a fading backdrop from a closed sub-dropdown in the way) the dialog just stayed open. The
	// following verifyTeamExists then passed anyway on a LEFTOVER "Front-End Team" row from an earlier
	// run (this spec uses a fixed name against an accumulating DB), and the failure only surfaced two
	// steps later as a second stacked dialog. clickAndAwaitDialogClose waits for Save to be enabled,
	// dispatches at the element, and requires ga-teams-mutation to DETACH — re-dispatching if it doesn't.
	await clickAndAwaitDialogClose(OrganizationTeamsPage.saveButtonCss, 'ga-teams-mutation');
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.selectTableRowCss);
};

export const selectTableRow = async (nameOrIndex: number | string) => {
	// Row click TOGGLES selection (selectTeam flips disableButton). Settle the grid first, then click the
	// row once and poll the toolbar Edit button's real disabled attr; only re-click if selection was lost.
	// POLLUTION-RESILIENT: the suite runs serially on ONE seed and the grid also holds the seeded "Default"
	// team, so a plain .first() row can grab the wrong record. When given a team name, scope to the row whose
	// Name cell contains it (the record this spec created); only fall back to .first() if no name is passed.
	const page = getPage();
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => undefined);
	await page.waitForTimeout(1500);

	// Filtering by name is what makes the row-scoping actually work: `.filter({ hasText })` can only see
	// the 10 rows the server rendered for the CURRENT page, so on an accumulated DB the spec's own team
	// is simply not among them and the click silently lands on nothing (or, via the .first() fallback,
	// on a foreign row that then gets edited/deleted). Best-effort — no-ops if the filter row is absent.
	if (typeof nameOrIndex === 'string' && nameOrIndex.length) {
		await scopeGridTo(OrganizationTeamsPage.nameFilterInputCss, nameOrIndex);
	}

	const rows = page.locator(OrganizationTeamsPage.selectTableRowCss);
	const row =
		typeof nameOrIndex === 'string' && nameOrIndex.length
			? rows.filter({ hasText: nameOrIndex }).first()
			: rows.first();
	const editBtn = page.locator(OrganizationTeamsPage.editButtonCss).first();

	await row.click({ force: true });
	for (let i = 0; i < 5; i++) {
		const disabled = await editBtn.getAttribute('disabled');
		if (disabled === null) {
			return; // selection took — toolbar actions enabled
		}
		await page.waitForTimeout(500);
		const stillDisabled = await editBtn.getAttribute('disabled');
		if (stillDisabled !== null) {
			await row.click({ force: true }); // selection lost/never applied — click once more
		}
	}
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.editButtonCss);
};

export const clickEditButton = async () => {
	// dispatchClick: the preceding add/save flow leaves fading cdk-overlay backdrops over the toolbar that
	// can swallow a coordinate click on Edit; dispatch fires openDialog() directly. Mirrors ContactsLeads.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationTeamsPage.editButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// dispatchClick: after the edit/save the toolbar can sit under a fading backdrop; dispatch fires
	// removeTeam() (which opens the confirm dialog) directly. Mirrors ContactsLeads.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationTeamsPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Confirm sits in a freshly opened nb-dialog over a backdrop — dispatch the click to the element.
	await dispatchClick(OrganizationTeamsPage.confirmDeleteButtonCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(OrganizationTeamsPage.toastrMessageCss);
};

export const verifyTeamExists = async (text: string) => {
	// Narrow the grid to THIS team before asserting: it is server-paginated at 10 rows and the serial
	// suite keeps adding teams to one shared DB, so the row the spec just created is regularly on page 2
	// and the unfiltered assertion failed with the record perfectly intact.
	await scopeGridTo(OrganizationTeamsPage.nameFilterInputCss, text);
	await verifyText(OrganizationTeamsPage.verifyTeamCss, text);
};

export const verifyTeamIsDeleted = async (text: string) => {
	// Same scoping: an absence assertion on an unfiltered, paginated grid is satisfied by the row simply
	// having moved to another page, which makes it both flaky AND too weak.
	await scopeGridTo(OrganizationTeamsPage.nameFilterInputCss, text);
	await verifyTextNotExisting(OrganizationTeamsPage.verifyTeamCss, text);
};
