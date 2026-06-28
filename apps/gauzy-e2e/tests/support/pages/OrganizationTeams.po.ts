import {
	verifyElementIsVisible,
	clickButtonByIndex,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
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
	await clearField(OrganizationTeamsPage.teamNameInputCss);
	await enterInput(OrganizationTeamsPage.teamNameInputCss, data);
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
	await clickButtonByIndex(OrganizationTeamsPage.tagsSelectOptionCss, index);
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
	await getPage().locator(OrganizationTeamsPage.cardBodyCss).first().click({ force: true }).catch(() => undefined);
};

export const saveButtonVisible = async () => {
	await verifyElementIsVisible(OrganizationTeamsPage.saveButtonCss);
};

export const clickSaveButton = async () => {
	// Save sits in the dialog; a fading backdrop from a closed sub-dropdown can intercept a coordinate
	// click, so dispatch the click straight to the element.
	await waitForSpinnerGone();
	await dispatchClick(OrganizationTeamsPage.saveButtonCss);
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
	await verifyText(OrganizationTeamsPage.verifyTeamCss, text);
};

export const verifyTeamIsDeleted = async (text: string) => {
	await verifyTextNotExisting(OrganizationTeamsPage.verifyTeamCss, text);
};
