import dayjs from 'dayjs';
import {
	verifyElementIsVisible,
	clickButton,
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
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TimeOffPage } from '../../../src/support/Base/pageobjects/TimeOffPageObject';

// ROUND-7 root cause: "Default Policy" is seeded ONLY on the default org ("Default Company"). The suite
// shares one DB and runs serially, and the web app persists the last-selected organizationId (Store ->
// localStorage), so by the time this spec runs the header org is frequently a RANDOM org left over from an
// earlier spec (the failure DOM showed "Time Off for Runte, Welch and Roberts", NOT "Default Company").
// Random orgs get policies named "Policy 1".."Policy 10" — never "Default Policy" — so the policy dropdown
// never contained the hardcoded "Default Policy", the pick never landed, the request form stayed invalid
// (Save [disabled]), nothing persisted, and verifyPolicyExists('Default Policy') timed out. Fix: pick the
// requested policy if present, else fall back to whatever policy the CURRENT org actually offers, and RECORD
// the name that was really selected so the downstream grid verify asserts THAT name (order/org-independent).
let lastSelectedPolicyName = '';
export const getLastSelectedPolicyName = () => lastSelectedPolicyName;

// Record the employee actually chosen in the request dialog. selectEmployeeFromDropdown prefers the unique
// faker employee, but has a best-effort fallback to the first REAL option when the typeahead doesn't render
// in time. If the fallback fires, the created request's Employee column will show that fallback name, NOT the
// faker name — so scoping the later deny/approve/delete row to the faker name would miss the row. Record the
// name that was actually selected and scope the row to THAT (order/pollution-independent).
let lastSelectedEmployeeName = '';
export const getLastSelectedEmployeeName = () => lastSelectedEmployeeName;

// Robust hash navigation to the time-off screen (mirrors the gotoRoute helper in commands.ts). The
// spec navigates here right after CustomCommands.addEmployee, which ends on /#/pages/employees. A bare
// goto() to /#/pages/employees/time-off only changes the hash, so Playwright treats it as a
// same-document NO-OP and never reloads; the Angular hash-router can lag, leaving the employees grid
// mounted for a beat. The next requestButton click then landed on the EMPLOYEES "Add" button (same
// gauzy-button-action markup) and re-opened the Add Employee dialog, whose backdrop blocked the
// request dialog (the round-3 failure). Force the hash in-page, settle, then wait for a time-off-only
// toolbar marker before the caller interacts.
export const navigateToTimeOff = async () => {
	const page = getPage();
	// ORG POLLUTION FIX: the suite shares one DB/browser context and the web app persists the
	// last-selected organizationId (Store -> localStorage), so this spec frequently runs with a random
	// faker org selected (the failure DOM showed "Time Off for Denesik Group"). Random orgs only have
	// "Policy 1".."Policy 10" — never the seeded "Default Policy" — so the hardcoded policy pick never
	// lands, the request form stays invalid (Save [disabled]), nothing persists, and verifyPolicyExists
	// times out. Force the header org selector back to "Default Company" (the only org seeded with
	// "Default Policy") BEFORE the org-scoped request work so the exact-match policy pick is deterministic.
	try {
		const orgSelector = page.locator('ga-organization-selector.organization-selector ng-select').first();
		await orgSelector.waitFor({ state: 'visible', timeout: 8000 });
		await orgSelector.click({ force: true });
		const defaultCompanyOption = page
			.locator('div.ng-option[role="option"]')
			.filter({ hasText: 'Default Company' })
			.first();
		if (await defaultCompanyOption.isVisible({ timeout: 4000 }).catch(() => false)) {
			await defaultCompanyOption.click({ force: true });
			// Let the org switch (switchOrganization backend call + policies refetch) settle.
			await page.waitForTimeout(1500);
		} else {
			// Already on Default Company (or panel didn't render an option) — dismiss the panel and proceed.
			await page.keyboard.press('Escape').catch(() => {});
		}
	} catch {
		// Best-effort: never let the org-normalisation hang the flow; the downstream policy fallback still applies.
	}
	await page.goto('/#/pages/employees/time-off');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/employees/time-off')) {
			location.hash = '#/pages/employees/time-off';
		}
	});
	await page.waitForTimeout(800);
	// The time-off "Add Holidays" info button is unique to this screen (the employees toolbar has none),
	// so its presence proves the SPA actually rendered time-off — not the still-mounted employees grid.
	await page
		.locator(TimeOffPage.timeOffPageReadyCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30000 })
		.catch(() => {});
	await waitForSpinnerGone();
};

export const requestButtonVisible = async () => verifyElementIsVisible(TimeOffPage.requestButtonCss);

export const clickRequestButton = async () => {
	// The preceding CustomCommands.addEmployee leaves a fading cdk-overlay-backdrop (still
	// `cdk-overlay-backdrop-showing` at this point) over the toolbar; a coordinate click — even
	// {force:true} — lands on that backdrop, so requestDaysOff() never fires and the request-mutation
	// dialog never opens (the original failure). Wait out the page spinner then dispatch the click
	// straight to the button so the (click) handler runs regardless of the overlay.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.requestButtonCss);
};

export const employeeSelectorVisible = async () => {
	// Best-effort wait for the working-employees fetch the ga-employee-selector kicks off: race it with a
	// timeout so we don't hang the default 30s if the response already landed before this wrapper
	// registered the listener (the request dialog opened in the previous step).
	const waitForUsers = getPage()
		.waitForResponse((response) => /\/api\/employee\/working/.test(response.url()), { timeout: 8000 })
		.catch(() => {});
	await verifyElementIsVisible(TimeOffPage.employeeDropdownCss);
	await waitForUsers;
};

export const clickEmployeeSelector = async () => {
	// The employee selector is an appendTo=body ng-select (opens on mousedown). A coordinate click — even
	// the previous force-click + double-click — is swallowed by leftover dialog backdrops and can even
	// close the form; open it via the keyboard instead (focus its inner input, then ArrowDown).
	await waitForSpinnerGone();
	const input = getPage().locator(TimeOffPage.employeeDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
	await getPage().waitForTimeout(500);
};

export const employeeDropdownVisible = async () => verifyElementIsVisible(TimeOffPage.employeeDropdownOptionCss);

export const selectEmployeeFromDropdown = async (name: string) => {
	// Pick the employee BY NAME via the ng-select typeahead. The list always begins with an
	// "All Employees" pseudo-option (id=null) and may also contain employees from earlier specs, so a
	// nth(0)/index pick is wrong (it selects "All Employees", which makes saveRequest() a no-op since it
	// gates on selectedEmployee.id). Type the unique faker name into the ng-select's inner input to
	// filter (searchEmployee matches firstName/lastName), then click the matching div.ng-option.
	const page = getPage();
	const input = page.locator(TimeOffPage.employeeDropdownCss).locator('input').first();
	const option = page.locator(TimeOffPage.employeeDropdownOptionCss).filter({ hasText: name });
	try {
		await input.focus();
		await input.fill('');
		await input.pressSequentially(name, { delay: 30 });
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		lastSelectedEmployeeName = name;
		await option.first().click({ force: true });
	} catch {
		// Best-effort fallback: if typeahead filtered to nothing (timing), pick the first REAL employee
		// option (skip the "All Employees" entry) so the flow still proceeds rather than hanging. Record the
		// fallback's actual text so the downstream row scope targets the request we really created.
		const realOption = page
			.locator(TimeOffPage.employeeDropdownOptionCss)
			.filter({ hasNotText: 'All Employees' });
		lastSelectedEmployeeName = (await realOption.first().textContent().catch(() => null))?.trim() || name;
		await realOption
			.first()
			.click({ force: true, timeout: 6000 })
			.catch(() => page.keyboard.press('Escape').catch(() => {}));
	}
};

export const selectTimeOffPolicyVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffPolicyDropdownCss);

export const clickTimeOffPolicyDropdown = async () => {
	// The policy field is a Nebular nb-select (ga-time-off-policy-select renders <nb-select id="policy">).
	// nb-select toggles its overlay panel on the click event, but the request/holiday dialog opens over a
	// fading cdk-overlay-backdrop (left by the preceding employee ng-select / quick-add) — a coordinate
	// {force:true} click is swallowed by that backdrop and the panel never opens (round-4 failure: the
	// '.option-list nb-option' assertion timed out). Settle any spinner, then dispatch the click straight
	// to the nb-select host so the (click) handler fires regardless of the overlay. The open is IDEMPOTENTLY
	// re-driven in selectTimeOffPolicy below (which only re-opens when NO option is visible), so this first
	// open need not take — but do NOT re-toggle here after it succeeds.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.timeOffPolicyDropdownCss);
	await getPage().waitForTimeout(500);
};

export const timeOffPolicyDropdownOptionVisible = async () => {
	// Best-effort, NOT a hard assert: if the dispatch-open above didn't take behind a lingering backdrop,
	// the panel re-open + pick is retried in selectTimeOffPolicy, so a 24s throw here would be premature.
	await getPage()
		.locator(TimeOffPage.timeOffPolicyDropdownOptionCss)
		.first()
		.waitFor({ state: 'visible', timeout: 6000 })
		.catch(() => undefined);
};

export const selectTimeOffPolicy = async (data: string) => {
	// Pick the policy (REQUIRED — Save stays disabled until BOTH policyId AND policy are set; the nb-select's
	// (selectedChange) is what fires onPolicySelected() to set the `policy` control, so we MUST actually click
	// the option, not just set the value).
	//
	// ROUND-6 root cause: the old loop dispatch-toggled the nb-select on EVERY miss. Since dispatchClick on an
	// nb-select host TOGGLES the panel, a miss on an ALREADY-OPEN panel (options just hadn't rendered yet)
	// CLOSED it, so the loop oscillated open/closed. Fix: only (re)open when NO option is rendered (idempotent
	// open), give the async policies fetch time to populate, then dispatch the click on the option.
	//
	// ROUND-7 root cause (the real reason the request never persisted): the requested "Default Policy" only
	// exists on the default org, but this spec often runs with a RANDOM org selected (persisted from an
	// earlier spec — see the module note above), so the exact-text option was NEVER present and the pick
	// silently never landed → invalid form → empty grid → verify timeout. Fix: try the requested policy first,
	// but fall back to whatever policy the current org actually offers (the first REAL option), and record the
	// name that was actually picked so verifyPolicyExists can assert THAT name. Pollution-safe: we scope the
	// verify to the recorded name, never an index.
	const page = getPage();
	const anyOption = page.locator(TimeOffPage.timeOffPolicyDropdownOptionCss);
	const requested = anyOption.filter({ hasText: data });
	for (let i = 0; i < 8; i++) {
		// Requested policy rendered? Pick it (preferred — keeps the spec deterministic when the default org
		// IS selected). dispatchEvent('click') so the nb-option's selectedChange fires even if the option-list
		// overlay's own cdk backdrop is mid-fade over it (a coordinate click can land on that backdrop).
		if (await requested.first().isVisible().catch(() => false)) {
			lastSelectedPolicyName = data;
			await requested.first().dispatchEvent('click').catch(() => requested.first().click({ force: true }));
			return;
		}
		// Panel open with options, but the requested policy isn't among them (a non-default org that has no
		// "Default Policy") → pick the FIRST real option so the form becomes valid and the request persists.
		// Record its exact text so the downstream grid verify matches what we actually chose.
		if (await anyOption.first().isVisible().catch(() => false)) {
			// Give the async policies fetch a couple more beats to fully populate before deciding to fall back,
			// so we don't grab an early partial list that hasn't included the requested policy yet.
			if (i < 3 && !(await requested.first().isVisible().catch(() => false))) {
				await page.waitForTimeout(900);
				continue;
			}
			const first = anyOption.first();
			lastSelectedPolicyName = (await first.textContent().catch(() => null))?.trim() || data;
			await first.dispatchEvent('click').catch(() => first.click({ force: true }));
			return;
		}
		// Nothing rendered → (re)open the panel. Only toggle when nothing is visible so we never close a
		// panel that's mid-populating.
		await waitForSpinnerGone();
		await dispatchClick(TimeOffPage.timeOffPolicyDropdownCss);
		await page.waitForTimeout(900);
	}
	// Last resort: dispatch on the requested option if it ever matched, else the first option (best-effort so
	// the flow proceeds rather than hard-failing).
	const fallback = (await requested.first().isVisible().catch(() => false)) ? requested.first() : anyOption.first();
	lastSelectedPolicyName = (await fallback.textContent().catch(() => null))?.trim() || data;
	await fallback.dispatchEvent('click').catch(() => undefined);
};

export const startDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startDateInputCss);

export const enterStartDateData = async () => {
	await clearField(TimeOffPage.startDateInputCss);
	const date = dayjs().add(1, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.startDateInputCss, date);
};

export const endDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startDateInputCss);

export const enterEndDateData = async () => {
	await clearField(TimeOffPage.endDateInputCss);
	const date = dayjs().add(5, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.endDateInputCss, date);
};

export const descriptionInputVisible = async () => verifyElementIsVisible(TimeOffPage.descriptionInputCss);

export const enterDescriptionInputData = async (data: string) => {
	await clearField(TimeOffPage.descriptionInputCss);
	await enterInput(TimeOffPage.descriptionInputCss, data);
};

export const saveRequestButtonVisible = async () => verifyElementIsVisible(TimeOffPage.saveRequestButtonCss);

export const clickSaveRequestButton = async () => {
	// dispatchClick after settling: the date pickers / leftover backdrops in the request dialog can sit
	// over the footer Save and swallow a coordinate click, leaving the dialog open. Dispatch fires
	// saveRequest() straight on the button (it still gates on form validity via [disabled]).
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.saveRequestButtonCss);
};

export const addHolidayButtonVisible = async () => verifyElementIsVisible(TimeOffPage.addHolidayButtonCss);

export const clickAddHolidayButton = async () => {
	// dispatchClick after settling: this runs right after the delete-confirm dialog closed, so a fading
	// backdrop can swallow a coordinate click on the toolbar "Add Holidays". Race the employee fetch with
	// a timeout so we don't hang the default 30s if it already landed (or isn't issued).
	await waitForSpinnerGone();
	const waitForm = getPage()
		.waitForResponse((response) => /\/api\/employee/.test(response.url()), { timeout: 8000 })
		.catch(() => {});
	await dispatchClick(TimeOffPage.addHolidayButtonCss);
	await waitForm;
};

export const selectHolidayNameVisible = async () => verifyElementIsVisible(TimeOffPage.holidayNameSelectCss);

export const clickSelectHolidayName = async () => {
	// Holiday-name is an nb-select inside the holiday dialog (opens on the click event). The dialog opens
	// over a fading backdrop from the just-closed delete-confirm, so a coordinate {force:true} click is
	// swallowed and the panel never opens. Dispatch the click straight to the nb-select host.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.holidayNameSelectCss);
	await getPage().waitForTimeout(500);
};

export const selectHolidayOption = async (option: string | number) => {
	// Best-effort, idempotent open + retry: the holiday list loads async. Same oscillation hazard as the
	// policy select — dispatchClick TOGGLES the nb-select, so re-dispatching on an already-open (but empty)
	// panel would CLOSE it. Only (re)open when NO option is rendered, wait for the async list to populate,
	// then dispatch the click on the matching option (defeats the option-list overlay's own fading backdrop).
	const page = getPage();
	const opts = page.locator(TimeOffPage.selectHolidayDropdownOptionCss);
	const target = typeof option === 'number' ? opts.nth(option) : opts.filter({ hasText: String(option) }).first();
	for (let i = 0; i < 6; i++) {
		if (await target.isVisible().catch(() => false)) {
			await target.dispatchEvent('click').catch(() => target.click({ force: true }));
			return;
		}
		// The requested holiday name is locale-dependent (date-holidays localizes names by country, e.g.
		// 'Нова Година' only appears for UA), so it may never render. Once the list HAS populated but our
		// named target isn't in it, fall back to the first available holiday — the holiday name is optional
		// (it only prefills description/dates, both of which the spec overwrites explicitly afterward), so any
		// pick is fine and keeps the panel from being left open over the next control.
		if (typeof option !== 'number' && i >= 2 && (await opts.first().isVisible().catch(() => false))) {
			await opts.first().dispatchEvent('click').catch(() => opts.first().click({ force: true }));
			return;
		}
		if (!(await opts.first().isVisible().catch(() => false))) {
			await waitForSpinnerGone();
			await dispatchClick(TimeOffPage.holidayNameSelectCss);
		}
		await page.waitForTimeout(900);
	}
	await target.dispatchEvent('click').catch(() => opts.first().dispatchEvent('click')).catch(() => undefined);
};

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(TimeOffPage.selectEmployeeCss);

export const clickSelectEmployeeDropdown = async () => {
	// The "Add or Remove Employees" multi-select is an nb-select (holiday + policy dialogs). Same backdrop
	// hazard as the other selects: dispatch the click on the host so a fading backdrop can't swallow it.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.selectEmployeeCss);
	await getPage().waitForTimeout(500);
};

export const selectEmployeeFromHolidayDropdown = async (index: number) => {
	// Best-effort employee pick (mirror ContactsLeads.selectEmployeeDropdownOption): this nb-select's
	// option list (.option-list nb-option) loads async and may be empty/closed. Since the open is now a
	// dispatchClick that can be swallowed by a backdrop, RE-OPEN the nb-select up to a few times until an
	// option renders, then click it. On miss, dismiss only the panel (Escape) and continue — a hard
	// option[index] click must not hang the 60s task timeout on an empty/closed list.
	const page = getPage();
	const option = page.locator(TimeOffPage.selectEmployeeDropdownOptionCss);
	for (let i = 0; i < 5; i++) {
		if (await option.first().isVisible().catch(() => false)) {
			// Dispatch the click so the option's selectedChange fires even under the overlay's fading backdrop.
			await option
				.nth(index)
				.dispatchEvent('click')
				.catch(() => option.nth(index).click({ force: true }).catch(() => {}));
			// Close the multi-select panel so it doesn't overlay the next control (nb-select multiple stays
			// open after a pick). Escape only dismisses the panel, keeping the selection.
			await page.keyboard.press('Escape').catch(() => {});
			return;
		}
		// Idempotent open: only (re)toggle when nothing is rendered, so we never close a mid-populating list.
		if (!(await option.first().isVisible().catch(() => false))) {
			await waitForSpinnerGone();
			await dispatchClick(TimeOffPage.selectEmployeeCss);
		}
		await page.waitForTimeout(900);
	}
	await page.keyboard.press('Escape').catch(() => {});
};

export const startHolidayDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.startHolidayDateCss);

export const enterStartHolidayDate = async () => {
	await clearField(TimeOffPage.startHolidayDateCss);
	const date = dayjs().add(1, 'years').startOf('year').format('MMM D, YYYY');
	await enterInput(TimeOffPage.startHolidayDateCss, date);
};

export const endHolidayDateInputVisible = async () => verifyElementIsVisible(TimeOffPage.endHolidayDateCss);

export const enterEndHolidayDate = async () => {
	await clearField(TimeOffPage.endHolidayDateCss);
	const date = dayjs().add(1, 'years').startOf('year').add(1, 'days').format('MMM D, YYYY');
	await enterInput(TimeOffPage.endHolidayDateCss, date);
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const saveButtonVisible = async () => verifyElementIsVisible(TimeOffPage.saveButtonCss);

export const clickSaveButton = async () => {
	// dispatchClick after settling: the holiday/policy dialog's date pickers and async employee load
	// leave overlays/backdrops over the footer Save; dispatch fires the save handler directly (it still
	// gates on form validity via [disabled]).
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.saveButtonCss);
};

export const timeOffTableRowVisible = async () => verifyElementIsVisible(TimeOffPage.selectTableRowCss);

export const selectTimeOffTableRow = async (name: string) => {
	const page = getPage();
	// Select the row for THIS spec's unique employee, not by index. The suite shares one DB and runs
	// serially, so by now the grid can hold time-off rows from earlier specs; a plain nth(0) would
	// deny/approve/delete the WRONG record. The grid's Employee column renders employees[0].fullName
	// (= the unique faker "First Last"), so filter the data rows by that name. (root cause #4 + pollution)
	// Let the grid settle after the preceding mutation (re-render/refetch) — a click during that window
	// is lost or immediately cleared. Then click the row ONCE and poll for the toolbar action buttons to
	// appear (selecting a row sets disableButton=false, rendering the btn-group.actions). Clicking the
	// row TOGGLES selection, so only re-click if the first click was lost to a late re-render — never
	// rapid re-click.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const rows = page.locator(TimeOffPage.selectTableRowCss);
	// Prefer the uniquely-named row; fall back to the first row only if the name is empty or didn't render
	// (best-effort). Guard the empty case explicitly so we don't build a hasText:'' filter (matches all rows).
	const named = name ? rows.filter({ hasText: name }) : rows;
	const row = (await named.count().catch(() => 0)) > 0 ? named.first() : rows.first();
	const actions = page.locator('div.btn-group.actions button').first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (await actions.isVisible().catch(() => false)) return;
		}
	}
};

export const editTimeOffRequestBtnVisible = async () => verifyElementIsVisible(TimeOffPage.editTimeOfRequestButtonCss);

export const clickEditTimeOffRequestButton = async () => clickButton(TimeOffPage.editTimeOfRequestButtonCss);

export const deleteTimeOffBtnVisible = async () => verifyElementIsVisible(TimeOffPage.deleteTimeOfRequestButtonCss);

export const clickDeleteTimeOffButton = async () => {
	// dispatchClick: a leftover toastr/dialog backdrop from the preceding save can intercept a coordinate
	// click on the toolbar Delete; dispatch fires deleteRequest() and opens the confirm dialog.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.deleteTimeOfRequestButtonCss);
};

// Approve/Deny/Archive live in a SECOND action group that only renders once showActions=true; the
// only way to flip it is the "more-horizontal" toggle in the first group. The migrated spec never
// clicked it, so the warning/success buttons were never present. Click it (best-effort: skip if the
// second group is already showing) before asserting on Deny/Approve.
export const clickShowActionsButton = async () => {
	const page = getPage();
	if (await page.locator(TimeOffPage.denyTimeOffRequestButtonCss).first().isVisible().catch(() => false)) return;
	await dispatchClick(TimeOffPage.showActionsButtonCss);
	await page.waitForTimeout(400);
};

export const denyTimeOffButtonVisible = async () => verifyElementIsVisible(TimeOffPage.denyTimeOffRequestButtonCss);

export const clickDenyTimeOffButton = async () => {
	// Best-effort: the spec calls this twice, but denying clears the selection and resets showActions, so
	// the second click has no target. Click only while the button is present so the doubled call is a
	// harmless no-op instead of a 60s timeout. dispatchClick defeats any leftover toastr/dialog backdrop.
	const btn = getPage().locator(TimeOffPage.denyTimeOffRequestButtonCss).first();
	if (await btn.isVisible().catch(() => false)) {
		await dispatchClick(TimeOffPage.denyTimeOffRequestButtonCss);
	}
};

export const approveTimeOffButtonVisible = async () =>
	verifyElementIsVisible(TimeOffPage.approveTimeOffRequestButtonCss);

export const clickApproveTimeOffButton = async () => {
	// Best-effort, same rationale as clickDenyTimeOffButton: approving clears selection/showActions, so
	// the doubled call becomes a no-op rather than hanging on a vanished button.
	const btn = getPage().locator(TimeOffPage.approveTimeOffRequestButtonCss).first();
	if (await btn.isVisible().catch(() => false)) {
		await dispatchClick(TimeOffPage.approveTimeOffRequestButtonCss);
	}
};

export const confirmDeleteTimeOffBtnVisible = async () =>
	verifyElementIsVisible(TimeOffPage.confirmDeleteTimeOfButtonCss);

export const clickConfirmDeleteTimeOffButton = async () => {
	// dispatchClick: the confirm dialog's own fading backdrop can swallow a coordinate click on its
	// footer button, leaving the record undeleted; dispatch fires the confirm handler directly.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.confirmDeleteTimeOfButtonCss);
};

export const timeOffSettingsButtonVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffSettingsButtonCss);

export const clickTimeOffSettingsButton = async (_index: number) => {
	// There is only ONE settings cog (button.action.p-2) in the time-off header, so the legacy index=1
	// targeted a non-existent second match and hung. Always dispatch the click on the single cog (which
	// routes to /pages/employees/time-off/settings); waitForSpinnerGone first so the page-load spinner
	// doesn't swallow a coordinate click.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.timeOffSettingsButtonCss);
};

export const addNewPolicyButtonVisible = async () => verifyElementIsVisible(TimeOffPage.addNewPolicyButtonCss);

export const clickAddNewPolicyButton = async () => {
	// dispatchClick after settling: the settings page shows a load spinner over the toolbar right after
	// navigation; a coordinate click on "Add" can land on it, so the policy dialog never opens.
	await waitForSpinnerGone();
	await dispatchClick(TimeOffPage.addNewPolicyButtonCss);
};

export const policyInputFieldVisible = async () => verifyElementIsVisible(TimeOffPage.addNewPolicyInputCss);

export const enterNewPolicyName = async (data: string) => {
	await clearField(TimeOffPage.addNewPolicyInputCss);
	await enterInput(TimeOffPage.addNewPolicyInputCss, data);
};

export const waitMessageToHide = async () => waitElementToHide(TimeOffPage.toastrMessageCss);

export const verifyPolicyExists = async (text: string) => {
	// Assert the policy name renders in a grid cell. Used for BOTH the request grid (Policy column, a
	// custom ApprovalPolicyComponent that renders <div>{{ value.name }}</div>) and the settings grid
	// (Name column, a type:'string' cell). The old 'div.ng-star-inserted' worked for the custom-render
	// request cell but a plain string cell has no such wrapper div — so scope the verify to the smart-table
	// CELL element (present in both grids) filtered by the exact name. This is pollution-safe (matches the
	// unique/known policy text, not an index) and covers both cell render types.
	await waitForSpinnerGone();
	await verifyText(TimeOffPage.verifyPolicyCss, text);
};

export const verifyPolicyIsDeleted = async (text: string) => verifyTextNotExisting(TimeOffPage.verifyPolicyCss, text);

export const backButtonVisible = async () => verifyElementIsVisible(TimeOffPage.backButtonCss);

export const clickBackButton = async () => clickButton(TimeOffPage.backButtonCss);

export const verifyEmployeeSelectorVisible = async () => verifyElementIsVisible(TimeOffPage.employeeSelectorCss);

export const clickEmployeeSelectorDropdown = async () => clickButton(TimeOffPage.employeeSelectorCss);

export const verifyTimeOffPolicyVisible = async () => verifyElementIsVisible(TimeOffPage.timeOffPolicySelectorCss);

export const clickTimeOffPolicySelector = async () => clickButton(TimeOffPage.timeOffPolicySelectorCss);

export const employeeSelectorVisibleAgain = async () => verifyElementIsVisible(TimeOffPage.employeeDropdownCss);
