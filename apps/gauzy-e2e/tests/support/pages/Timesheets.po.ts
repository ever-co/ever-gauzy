import {
	verifyElementIsVisible,
	clickButton,
	clearField,
	enterInput,
	clickKeyboardBtnByKeycode,
	waitElementToHide,
	verifyText,
	verifyTextNotExisting,
	clickButtonDouble,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { TimesheetsPage } from '../../../src/support/Base/pageobjects/TimesheetsPageObject';
import { TimesheetsPageData } from '../../../src/support/Base/pagedata/TimesheetsPageData';

// ng-select (project/client/task/start-time) opens on MOUSEDOWN and a force-click on its control is
// either swallowed by the fading dialog backdrop or closes the dialog. Open it via the keyboard:
// focus the control's input and press ArrowDown so the option panel (div.ng-option appended to body)
// renders. See migration ROOT CAUSE #3.
const openNgSelect = async (selector: string, typeahead?: string) => {
	const input = getPage().locator(selector).locator('input').first();
	const option = getPage().locator(TimesheetsPage.dropdownOptionCss).first();
	// Retry the keyboard-open: a single focus+ArrowDown is occasionally a no-op when a fading dialog
	// backdrop still owns focus (observed: the project ng-select never opened, so the 'Gauzy Web Site'
	// option pick timed out at 60s). Re-focus + ArrowDown until an option renders (or give up after a
	// few tries and let the caller's click time out with a clearer signal).
	for (let attempt = 0; attempt < 3; attempt++) {
		await input.focus().catch(() => {});
		await getPage().keyboard.press('ArrowDown').catch(() => {});
		// Typeahead-filter when a search term is given: typing into the ng-select input both guarantees
		// the panel is THIS control's (not a leftover div.ng-option panel from an earlier ng-select whose
		// backdrop is still fading) and narrows the option list to the wanted row, so the async project
		// fetch's target ('Gauzy Web Site') is the only/first div.ng-option — deterministic even under
		// virtual-scroll or a slow getProjects() load. (ROOT CAUSE #3 typeahead variant.)
		if (typeahead) {
			await input.fill('').catch(() => {});
			await input.pressSequentially(typeahead, { delay: 30 }).catch(() => {});
		}
		try {
			await option.waitFor({ state: 'visible', timeout: 8_000 });
			return; // panel open, options rendered
		} catch {
			// closed again / not yet loaded — retry the open
		}
	}
};

// Best-effort ng-option pick: a slow or absent option must not hard-fail the flow. (The old
// clickElementByText/clickButtonByIndex used a 60s force-timeout, and the round-6 failure was exactly
// that hanging on the 'Gauzy Web Site' option.) Pick by text if it shows up within a short window,
// else by index, else Escape and move on so the flow still reaches Save.
//
// Whether these dropdowns are optional is the ORGANISATION's call, not the form's. Reading
// `edit-time-log-modal.buildForm()` alone says "no Validators anywhere, so `form.invalid` is always
// false" — but validators also arrive from the TEMPLATE: `employeeId` carries a bare `required`, and
// client/project/task/description/reason carry `[required]="organization?.requireX"`. Under the
// default seed those flags are off and only the employee is required (and `addTime()` falls back to
// the current user's employee id anyway), which is why skipping them still saves. On an organisation
// that sets any `require*` flag it would not, and Save is a SILENT no-op — `addTime()` opens with
// `if (this.form.invalid) return;`. `clickSaveTimeLogButton` below reports which controls are still
// invalid for exactly that reason.
const bestEffortPick = async (text?: string, index = 0) => {
	const page = getPage();
	const options = page.locator(TimesheetsPage.dropdownOptionCss);
	try {
		await options.first().waitFor({ state: 'visible', timeout: 8_000 });
		if (text) {
			const byText = options.filter({ hasText: text }).first();
			if ((await byText.count()) > 0) {
				await byText.click({ force: true, timeout: 8_000 });
				return;
			}
		}
		await options.nth(index).click({ force: true, timeout: 8_000 });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

// The spec's bare `await getPage().goto('/#/pages/employees/timesheets/daily')` is issued right after
// the addTask/addClient CustomCommands, which END on DIFFERENT hash routes (/#/pages/tasks/dashboard,
// /#/pages/contacts/clients). A hash-only goto() between two same-document routes is a NO-OP in
// Playwright: the page isn't reloaded and the Angular hash-router never fires, so the SPA stays on the
// previous screen (the observed failure DOM was still the Clients "Add New Contact" page, mid-submit
// with its card spinner still up).
//
// ROUND 7 root cause: a plain hash goto()/force can't dislodge a WEDGED previous screen — if the
// preceding addClient's contact-mutation form is still rendering (in-flight submit / geocode spinner),
// the daily route's "Add Time" toolbar button never mounts, the visibility wait below is swallowed, and
// the whole timesheets flow then runs against the dead Clients DOM (the div.ng-option 'Gauzy Web Site'
// pick times out because the Add Time dialog was never opened). Re-anchor with a HARD RELOAD: set the
// hash first, then reload() so the browser re-fetches index.html and Angular re-bootstraps cleanly on
// the daily route, discarding any leftover form/overlay/spinner from the prerequisite. (ROOT CAUSE #8 +
// ROUND 7 (b) "re-anchor to your route via hard reload before acting".)
export const navigateToDaily = async () => {
	const page = getPage();
	// Point the hash at the daily route, then force a real document reload so a stuck prerequisite
	// screen (e.g. an addClient contact form still spinning) can't survive into our flow.
	await page.goto('/#/pages/employees/timesheets/daily');
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/employees/timesheets/daily')) {
			location.hash = '#/pages/employees/timesheets/daily';
		}
	});
	await page.reload();
	// After the reload the hash is preserved; confirm the router landed on daily (belt-and-braces).
	await page.evaluate(() => {
		if (!location.hash.includes('/pages/employees/timesheets/daily')) {
			location.hash = '#/pages/employees/timesheets/daily';
		}
	});
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(800);
	// Don't proceed until the daily screen has actually rendered: its toolbar "Add Time" button only
	// exists once the SPA route finished re-rendering.
	await page
		.locator(TimesheetsPage.addTimeButtonCss)
		.first()
		.waitFor({ state: 'visible', timeout: 30_000 })
		.catch(() => {});
};

export const addTimeButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.addTimeButtonCss);

export const clickAddTimeButton = async () => {
	// Settle any spinner/fading backdrop left by the preceding navigation, then dispatch the click
	// straight to the toolbar "Add Time" button so its (click)="openAdd()" fires even if an overlay is
	// still on top (a coordinate click — even force — would land on the backdrop). (ROOT CAUSE #2.)
	await waitForSpinnerGone();
	await dispatchClick(TimesheetsPage.addTimeButtonCss);
};

export const selectEmployeeDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.selectEmployeeCss);

export const clickSelectEmployeeDropdown = async () => clickButton(TimesheetsPage.selectEmployeeCss);

export const selectEmployeeFromDropdown = async (index: number) => {
	// Best-effort employee pick (mirrors ContactsLeads.po.selectEmployeeDropdownOption): the option list
	// (org employees "working" in the header date range) loads async. With the now-fixed addEmployee it
	// should contain at least the seeded admin + the added employee, but keep this resilient — select the
	// option if it shows within ~8s, otherwise Escape and continue rather than hard-hanging 60s on an
	// empty list (ROUND 3 guidance).
	const page = getPage();
	const option = page.locator(TimesheetsPage.selectEmployeeDropdownOptionCss);
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const dateInputVisible = async () => verifyElementIsVisible(TimesheetsPage.dateInputCss);

export const enterDateData = async () => {
	// DO NOT clear/refill the date input. The edit-time-log modal's CONSTRUCTOR already seeds a valid
	// `selectedRange` (now-1h .. now, i.e. today — inside the header's current-week filter) and the
	// range-picker's writeValue() derives a valid `date`/`startTime`/`endTime` from it. The picker's
	// ngAfterViewInit subscribes to the date input's valueChanges and RECOMPUTES `selectedRange` from
	//   new Date(moment(this.date).format('YYYY-MM-DD') + ' ' + this.startTime + tzOffset)
	// (timer-range-picker.component.ts). clearField() nulls `this.date`, and re-typing a
	// 'MMM D, YYYY' string doesn't parse under the picker's 'YYYY-MM-DD' nbDatepicker format, so
	// `this.date` goes invalid → start/end become NaN → `selectedRange = { start: null, end: null }`.
	// addTime() has NO form validators (buildForm declares none, so form.invalid is always false) and
	// then does toUTC(null) on save → the request errors, an error toast shows and the dialog stays
	// OPEN → the time log is never created → the next step's row-select finds no row and times out.
	// The default range is exactly what we want (today), so leave the field untouched — this makes the
	// save deterministically valid in both the create AND edit steps. (ROUND 8 (a): prove the record
	// persists — the create/edit form must stay valid.)
	await verifyElementIsVisible(TimesheetsPage.dateInputCss);
};

export const startTimeDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.startTimeDropdownCss);

// Open via keyboard — never a force-click (would close the dialog / hit the backdrop).
export const clickStartTimeDropdown = async () => openNgSelect(TimesheetsPage.startTimeDropdownCss);

export const selectTimeFromDropdown = async (index: number) => bestEffortPick(undefined, index);

export const clientDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.clientDropdownCss);

export const clickClientDropdown = async () => openNgSelect(TimesheetsPage.clientDropdownCss);

export const selectClientFromDropdown = async (text: string | number) =>
	// ng-option index-based pick (the visible option after opening); text is unreliable here because the
	// contact list label may differ from the data passed in. Best-effort — the client is optional for a
	// valid time-log save.
	bestEffortPick(undefined, Number(text) || 0);

export const selectProjectDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.projectDropdownCss);

// Open the project ng-select AND typeahead-filter to the wanted project so its option is the only
// div.ng-option rendered (the prior plain ArrowDown open intermittently matched a stale panel and then
// the 'Gauzy Web Site' text-pick timed out at 60s — the observed round-6 failure). Filter on the first
// word only ('Gauzy') so ng-select's contains-match still yields the full 'Gauzy Web Site' row.
export const clickSelectProjectDropdown = async () =>
	openNgSelect(TimesheetsPage.projectDropdownCss, String(TimesheetsPageData.defaultProjectName).split(' ')[0]);

export const selectProjectFromDropdown = async (text: string) =>
	// Prefer the wanted project by text (typeahead-filtered open above narrows the panel to it), but stay
	// best-effort so a slow project fetch can't hard-block the flow — the save persists regardless.
	bestEffortPick(text, 0);

export const taskDropdownVisible = async () => verifyElementIsVisible(TimesheetsPage.taskDropdownCss);

export const clickTaskDropdown = async () => openNgSelect(TimesheetsPage.taskDropdownCss);

export const selectTaskFromDropdown = async (index: number) =>
	// Best-effort — the task/start-time option is optional for a valid save; don't hang 60s on an empty
	// or slow-loading panel.
	bestEffortPick(undefined, index);

export const addTimeLogDescriptionVisible = async () => verifyElementIsVisible(TimesheetsPage.descriptionTextareaCss);

export const enterTimeLogDescriptionData = async (data: string) => {
	await clearField(TimesheetsPage.descriptionTextareaCss);
	await enterInput(TimesheetsPage.descriptionTextareaCss, data);
};

export const saveTimeLogButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.saveTimeButtonCss);

// Unlike every other footer Save in this suite (AddTasks/TimeOff have an explicit (click)="onSave()"),
// the edit-time-log dialog submits via the FORM's `(submit)="addTime()"` binding — its footer button
// has NO (click) handler and is just an implicit type=submit. A synthetic dispatchEvent('click') (what
// dispatchClick does) therefore does NOT perform native form submission, so the old dispatchClick left
// the dialog open and never created a time log (observed: filled "Add Time Logs" dialog still up, grid
// "No Data", the next step's row click then timed out). Trigger the real submit instead: call
// requestSubmit() on the dialog's <form> (fires the (submit) handler regardless of any fading backdrop
// and still gates on the disabled/spinner state), with a real-click fallback.
// The dialog's own <form>. Scoped by the Save button it contains rather than by the component tag, so
// it keeps matching if the modal is renamed. Only one such dialog is ever open at a time.
const timeLogFormCss = `form:has(${TimesheetsPage.saveTimeButtonCss})`;

/**
 * Submit the Add/Edit Time Log dialog and wait until it has actually been accepted.
 *
 * Two SILENT no-ops make "I clicked Save" a much weaker claim than it looks here, and both were
 * observed in CI run 30987411046 (shard 4, all three attempts):
 *
 *  1. `addTime()` opens with `if (this.form.invalid) return;` — no toast, no error, no visual change.
 *     The employee select is `required`, so until it commits its value the form is invalid and Save
 *     does NOTHING. Snapshot: the filled "Add Time Logs" dialog still up and no new row.
 *  2. `requestSubmit()` honours the submit button's `[disabled]="loading"` gate, so it also silently
 *     does nothing while a previous save is in flight.
 *
 * The old code returned "submitted" as soon as it found the <form>, so both no-ops read as success.
 * The spec then failed two steps later with "row not found" / "eye-outline not visible", which names
 * neither cause. So: wait for the form to be genuinely submittable, then treat the dialog CLOSING as
 * the success signal (that is what `addTime()` does on success), and report which controls are still
 * invalid if it never does.
 */
export const clickSaveTimeLogButton = async () => {
	await waitForSpinnerGone();
	const page = getPage();

	const dialogGone = async () => (await page.locator(timeLogFormCss).count().catch(() => 1)) === 0;

	const submitOnce = async () =>
		page
			.evaluate((btnSel) => {
				const btn = document.querySelector(btnSel) as HTMLButtonElement | null;
				const form = btn?.closest('form') as HTMLFormElement | null;
				if (!form || btn?.disabled) return false;
				form.requestSubmit(btn ?? undefined);
				return true;
			}, TimesheetsPage.saveTimeButtonCss)
			.catch(() => false);

	// BOTH submit paths are no-ops while the button is disabled — requestSubmit() honours the gate, and
	// a click (forced or not) on a disabled button performs no default action — so "enabled" is the
	// shared precondition, not something a fallback can work around. An unreadable state just keeps us
	// waiting, which is safe here: only the end-state check below decides success.
	const saveBtnEnabled = async () => {
		const btn = page.locator(TimesheetsPage.saveTimeButtonCss).first();
		if ((await btn.count().catch(() => 0)) === 0) return false;
		return btn.isEnabled().catch(() => false);
	};

	for (let attempt = 0; attempt < 3; attempt++) {
		// Check the END STATE before acting: a dialog that closed while we were waiting is a success,
		// not a reason to submit again into whatever screen replaced it.
		if (await dialogGone()) return;

		// Angular puts ng-valid/ng-invalid on the [formGroup] host, so form validity — the thing
		// `addTime()` actually gates on — is readable from the DOM.
		await page
			.locator(`${timeLogFormCss}.ng-valid`)
			.waitFor({ state: 'attached', timeout: 20_000 })
			.catch(() => undefined);

		for (let i = 0; i < 20 && !(await saveBtnEnabled()); i++) {
			if (await dialogGone()) return;
			await page.waitForTimeout(500);
		}

		if (await dialogGone()) return;

		// Final attempt uses a REAL click so the button's own native default action runs, in case the
		// synthetic submit is being swallowed. Unconditional rather than a fallback on submitOnce()'s
		// return: the case worth retrying differently is "submit fired but the dialog never closed",
		// and there submitOnce() returns true. Not forced — we just waited for it to be enabled.
		if (attempt === 2) {
			await page
				.locator(TimesheetsPage.saveTimeButtonCss)
				.first()
				.click()
				.catch(() => undefined);
		} else {
			await submitOnce();
		}

		for (let i = 0; i < 24; i++) {
			if (await dialogGone()) return;
			await page.waitForTimeout(500);
		}
	}

	// One last look: the final 500ms wait may be exactly when the dialog closed.
	if (await dialogGone()) return;

	const invalid = await page
		.$$eval(`${timeLogFormCss} .ng-invalid[formcontrolname]`, (els: Element[]) =>
			els.map((el) => el.getAttribute('formcontrolname'))
		)
		.catch(() => [] as (string | null)[]);
	throw new Error(
		`Add/Edit Time Log dialog never closed after 3 submit attempts, so no time log was written. ` +
			`Controls still invalid: [${invalid.join(', ') || 'none — check for a save error toast'}]`
	);
};

export const closeAddTimeLogPopoverButtonVisible = async () =>
	verifyElementIsVisible(TimesheetsPage.closeAddTimeLogPopoverCss);

export const clickCloseAddTimeLogPopoverButton = async () => dispatchClick(TimesheetsPage.closeAddTimeLogPopoverCss);

// Returns true once the toolbar button is rendered AND not disabled (i.e. a row is currently selected
// — the View/Edit/Delete buttons only exist in the DOM via `@if (selectedItem)` once a row is picked).
const toolbarBtnReady = async (toolbarBtnCss: string): Promise<boolean> => {
	const btn = getPage().locator(toolbarBtnCss).first();
	if ((await btn.count()) === 0) return false;
	if (!(await btn.isVisible().catch(() => false))) return false;
	return (await btn.getAttribute('disabled').catch(() => null)) === null;
};

// Select the time-log row WE created so the toolbar View/Edit/Delete buttons become enabled. Two
// gotchas drive this logic:
//  1. POLLUTION: the grid is shared across the serial suite (other specs add time logs too), so target
//     OUR row by its unique-to-this-step description rather than blindly row 0 (ROUND 5), with a
//     first-row fallback.
//  2. TOGGLE: userRowSelect() TOGGLES isSelected, and closing the VIEW dialog does NOT refresh the grid
//     (its close passes null, which openView() filters out) — so the row stays selected going into the
//     Edit step. Clicking an already-selected row would DESELECT it and the Edit button would vanish.
//     Hence: only click the row when the toolbar button isn't already ready; never blindly re-click.
/**
 * Make sure the daily view has actually queried for the log we just created.
 *
 * The daily component refreshes `logs$` when the Add Time dialog closes, and that refresh can race the
 * write. In the run this was diagnosed from, POST /api/timesheet/time-log returned 201 and a GET of the
 * same day DID return the log — yet the grid was still rendering its "No Data" empty state, so there
 * was no row to select and the click timed out. A reload re-runs the query.
 *
 * Bounded, and keyed on OUR row appearing rather than on time: if the log genuinely is not there the
 * caller's own assertion still fails, and if the row is already rendered this costs nothing.
 */
const ensureOurRowRendered = async () => {
	const page = getPage();
	const ours = page.locator(TimesheetsPage.timeLogRowCss).filter({ hasText: TimesheetsPageData.defaultDescription });
	for (let attempt = 0; attempt < 2; attempt++) {
		if ((await ours.count().catch(() => 0)) > 0) return;
		// Bound both waits. `reload()` and `waitForLoadState('networkidle')` inherit the (long)
		// navigation/global timeout otherwise, which is how this helper's worst case reached minutes
		// rather than seconds — util.ts:131 already bounds networkidle for the same reason.
		await page.reload({ timeout: 20_000 }).catch(() => undefined);
		await page.waitForTimeout(1500);
		await waitForSpinnerGone();
		await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
		await page.waitForTimeout(1500);
	}
};

const selectRowFor = async (toolbarBtnCss: string) => {
	await waitForSpinnerGone();
	await getPage().waitForLoadState('networkidle').catch(() => {});
	await getPage().waitForTimeout(1500);
	// Already selected (e.g. left selected after the View dialog closed)? Don't toggle it off.
	if (await toolbarBtnReady(toolbarBtnCss)) return;
	await ensureOurRowRendered();

	// Fail HERE, immediately, when the grid rendered nothing.
	//
	// Without this the loop below spends the entire 240s test budget "observing" a locator that
	// matches zero elements — `locator.evaluate()` auto-waits, so every probe burns the full
	// `actionTimeout` (24s) and returns `undefined`, which the loop correctly treats as "unknown" and
	// waits out. Six of those is ~144s, the test dies at 240s, and the diagnostic below never runs:
	// the timeout masks the very message written to explain the failure.
	//
	// The URL matters more than the message: this state is reached when the daily grid is querying a
	// DIFFERENT DAY than the one the time log was written to, so `?date=` names the bug outright.
	if ((await getPage().locator(TimesheetsPage.timeLogRowCss).count()) === 0) {
		throw new Error(
			`Daily grid rendered NO time-log rows ("No Data") after 2 reloads, so there is nothing to ` +
				`select. The log we created is not inside the day the grid is querying — check the day in ` +
				`the URL against the log's startedAt. URL=${getPage().url()}`
		);
	}

	const ours = getPage()
		.locator(TimesheetsPage.timeLogRowCss)
		.filter({ hasText: TimesheetsPageData.defaultDescription })
		.first();
	const row = (await ours.count()) > 0 ? ours : getPage().locator(TimesheetsPage.timeLogRowCss).first();

	/**
	 * The row click TOGGLES selection (`(click)="userRowSelect(log)"`), so a retry
	 * loop that re-clicks whenever the toolbar "is not ready yet" will happily
	 * DESELECT a correctly-selected row and oscillate. The previous loop did exactly
	 * that: check, wait 800ms, check again, click again — with the toolbar only
	 * appearing after Angular renders `#actionButtons`, that races on every run and
	 * could finish deselected.
	 *
	 * The row carries `[class.selected]="log?.isSelected"`, so selection is
	 * observable directly. Drive to the desired STATE instead of blind-toggling:
	 * only click when the row is not selected, and treat "selected but toolbar not
	 * rendered yet" as something to wait out, never to click again.
	 *
	 * `dispatchEvent('click')` rather than `click({ force: true })`: force only skips
	 * the actionability CHECK, the event is still delivered at coordinates and can be
	 * eaten by whatever occupies that point — which is how this spec failed in CI
	 * ("locator.click: Timeout" on a row that was present).
	 */
	/**
	 * `undefined` when the state could not be READ (a transient re-render detaches
	 * the node and `evaluate` throws). Deliberately not `false`: "unknown" is not
	 * "unselected", and collapsing the two would click an already-selected row and
	 * reintroduce the very oscillation this loop exists to prevent.
	 */
	const isSelected = async (): Promise<boolean | undefined> => {
		// `locator.evaluate()` AUTO-WAITS for the element, so an unmatched locator costs the full
		// `actionTimeout` (24s, playwright.config.ts:66) per call — a "cheap observation" that is
		// anything but. Short-circuit on count() first, and bound the read itself, so a probe stays a
		// probe: worst case ~1s instead of 24s.
		if ((await row.count().catch(() => 0)) === 0) return undefined;
		return row
			.evaluate((el) => el.classList.contains('selected'), undefined, { timeout: 1_000 })
			.catch(() => undefined);
	};

	for (let i = 0; i < 6; i++) {
		if (await toolbarBtnReady(toolbarBtnCss)) return; // selected AND toolbar enabled
		// Click ONLY on an explicit `false`. On `undefined` wait and re-observe.
		if ((await isSelected()) === false) {
			await row.dispatchEvent('click').catch(() => undefined);
		}
		await getPage().waitForTimeout(800);
	}

	// One last look before giving up: the loop's final wait may be exactly when the
	// toolbar became ready, and throwing on the pre-wait observation would be the
	// same "not observed yet means it did not happen" mistake this whole helper
	// exists to remove.
	if (await toolbarBtnReady(toolbarBtnCss)) return;

	// Fail HERE rather than letting the caller's generic visibility assertion time
	// out: "the toolbar never enabled" and "the button is missing" have different
	// causes, and the caller's message cannot tell them apart.
	throw new Error(
		`Timesheet row selection never enabled the toolbar after 6 attempts (${toolbarBtnCss}); ` +
			`row selected=${await isSelected()}`
	);
};

export const viewEmployeeTimeLogButtonVisible = async () => {
	await selectRowFor(TimesheetsPage.viewEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.viewEmployeeTimeCss);
};

export const clickViewEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.viewEmployeeTimeCss);

export const editEmployeeTimeLogButtonVisible = async () => {
	await selectRowFor(TimesheetsPage.editEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.editEmployeeTimeCss);
};

export const clickEditEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.editEmployeeTimeCss);

export const deleteEmployeeTimeLogButtonVisible = async () => {
	await selectRowFor(TimesheetsPage.deleteEmployeeTimeCss);
	return verifyElementIsVisible(TimesheetsPage.deleteEmployeeTimeCss);
};

export const clickDeleteEmployeeTimeLogButton = async (_index: number) =>
	dispatchClick(TimesheetsPage.deleteEmployeeTimeCss);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(TimesheetsPage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => dispatchClick(TimesheetsPage.confirmDeleteButtonCss);

export const waitMessageToHide = async () => waitElementToHide(TimesheetsPage.toastrMessageCss);

export const verifyTimeExists = async (text: string) => verifyText(TimesheetsPage.verifyTimeCss, text);

export const verifyTimeIsDeleted = async (text: string) => verifyTextNotExisting(TimesheetsPage.verifyTimeCss, text);

export const doubleClickClientDropdown = async () => clickButtonDouble(TimesheetsPage.clientDropdownCss);
