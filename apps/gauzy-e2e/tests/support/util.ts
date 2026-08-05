import { expect } from '@playwright/test';
import { getPage } from './page-context';
import { resolveOptionSelector } from './ng-select';

/**
 * Playwright port of the Cypress util layer (src/support/Base/utils/util.ts).
 *
 * Same function names + argument order as the Cypress version so the page
 * objects and step definitions migrate with minimal churn — the difference is
 * these are **async** (callers must `await`) and use the module-scoped `page`
 * (see page-context.ts) instead of the global `cy`.
 *
 * Timeouts mirror the old cypress.json values.
 */
const defaultCommandTimeout = 24_000;
const taskTimeout = 60_000;

const loc = (selector: string) => getPage().locator(selector);

/**
 * `loc()` for selectors that MAY address ng-select options.
 *
 * ng-select renders "No items found" / "Loading…" / "Type to search" as
 * `div.ng-option.ng-option-disabled` — the same class real choices carry. Every util below that
 * WAITS FOR or CLICKS an option therefore has to exclude those placeholders, or it either proceeds
 * against an empty list or clicks a row ng-select ignores (a silent no-op that submits null; see
 * ng-select.ts for the proof).
 *
 * `resolveOptionSelector` upgrades the selector only once a real option has actually rendered, and
 * otherwise returns the caller's original selector untouched — so this is strictly safer than what
 * it replaces and cannot turn a step that used to pass into one that fails. Non-option selectors
 * (the vast majority, plus every Nebular `nb-option` one) are returned as-is with no extra wait.
 */
const optionAwareLoc = async (selector: string) => loc(await resolveOptionSelector(selector));

export const getTitle = async (): Promise<string> => getPage().title();

export const verifyText = async (selector: string, data: string) =>
	// Verify SOME element matching `selector` contains `data` (not necessarily the first). The earlier
	// .first().toContainText asserted only the first match, which fails the common "is X among the
	// rendered options/rows/cards?" check when X isn't first (dropdown options, grid rows, reused
	// headers). Filter by text then assert visibility — covers both the single-element and among-many
	// intents, retry-safe, and no Playwright strict-mode violation.
	expect((await optionAwareLoc(selector)).filter({ hasText: data }).first()).toBeVisible({
		timeout: defaultCommandTimeout
	});

export const verifyValue = async (selector: string, data: string) =>
	expect(loc(selector).first()).toHaveValue(data, { timeout: defaultCommandTimeout });

export const verifyTextNotExisting = async (selector: string, text: string) =>
	// Assert NO element matching `selector` contains `text` (the "row was deleted" check). The earlier
	// `.not.toContainText` throws a strict-mode violation when `selector` matches multiple elements
	// (e.g. several grid rows remain); filter by text then assert zero matches — handles 0, 1 or many.
	expect(loc(selector).filter({ hasText: text })).toHaveCount(0, { timeout: defaultCommandTimeout });

export const verifyTextNotExistByIndex = async (selector: string, index: number, data: string) =>
	expect(loc(selector).nth(index)).not.toHaveText(data);

export const verifyTextByIndex = async (selector: string, data: string, index: number) =>
	expect(loc(selector).nth(index)).toContainText(data);

export const clickButton = async (selector: string) =>
	(await optionAwareLoc(selector)).first().click({ force: true, timeout: taskTimeout });

/**
 * Click a control only once it is genuinely INTERACTIVE (not `disabled`).
 *
 * `clickButton` above passes `force: true`, and **force does not bypass `disabled`**. It skips
 * Playwright's actionability CHECK, but the click is still delivered as a real mouse event at the
 * element's coordinates — and the HTML spec has the browser drop click events queued on a *disabled*
 * form control instead of dispatching them. So a forced click on a button whose `[disabled]` binding
 * Angular has not re-evaluated yet is a SILENT no-op: nothing is clicked, no error is raised, and the
 * spec dies many seconds later on whatever that click was supposed to produce.
 *
 * That is exactly how the register submit was being lost: the terms checkbox is clicked ~40ms earlier
 * and `[disabled]="submitted || !form.valid || !user.terms"` only clears on Angular's next
 * change-detection pass, so the run failed a minute later in the NEXT step with
 * `locator.fill: Timeout 60000ms exceeded … waiting for locator('#nameInput')`.
 *
 * Gating on `toBeEnabled` waits for the state that actually matters and retries until it holds, so no
 * sleep is needed. `force` defaults to OFF because the point is that the control must be interactive;
 * callers that also have to survive a fading overlay can opt back in.
 */
export const clickWhenEnabled = async (selector: string, options: { force?: boolean } = {}) => {
	const target = loc(selector).first();
	await expect(target).toBeEnabled({ timeout: defaultCommandTimeout });
	await target.click({ force: options.force ?? false, timeout: taskTimeout });
};

// DOM-level click that bypasses overlay hit-testing: dispatches the event straight to the element so
// the framework's (click) handler fires even when a fading cdk-overlay backdrop sits on top. A
// coordinate click — even {force:true} — lands on the backdrop instead, because force only skips the
// actionability *check*, it still dispatches at the element's screen coordinates. Element must be
// attached (assert visibility first if the control is conditionally rendered).
export const dispatchClick = async (selector: string) =>
	loc(selector).first().dispatchEvent('click');

// Best-effort wait for the full-card nb-spinner (shown while a stepper step loads its async data) to
// detach. While it's up it overlays the footer buttons, so a coordinate click lands on the spinner
// rather than the button. Swallows timeout so callers still proceed (then use dispatchClick).
// Short by design: the location step's address-geocode spinner can stay up indefinitely (offline/slow
// geocode), so callers pair this with dispatchClick, which fires regardless of the overlay. We only
// want to absorb a transient spinner, not block on a stuck one.
export const waitForSpinnerGone = async (timeout = 4_000) =>
	loc('nb-spinner').first().waitFor({ state: 'detached', timeout }).catch(() => {});

/**
 * Click a control that sits under a loading overlay or an in-flight CSS transition, and prove the
 * click landed.
 *
 * The grid pages wrap their card in `[nbSpinner]="loading"`, whose overlay covers the whole card —
 * header toolbar included — at z-index 9999, and ngx-gauzy-button-action slides its action bar in over
 * ~0.2s. A coordinate click issued while either is in flight is delivered at screen coordinates and
 * lands on the overlay (or on whichever button has slid into that spot): `force: true` only skips the
 * actionability CHECK, it does not change where the click is delivered. That is how the Users toolbar
 * clicks were being lost ~1.9s after navigation, and how edit-user's Edit click landed on "Convert to
 * employee" instead.
 *
 * So: settle first (spinner detached + network idle), then dispatch the event straight at the element
 * so no overlay can intercept it, then wait for `confirmSelector` — the thing the click is supposed to
 * produce, e.g. the dialog's first input — and dispatch once more if it never appeared. Raising a
 * timeout would not have helped: the click was never delivered to the button in the first place.
 */
export const dispatchClickWhenSettled = async (selector: string, confirmSelector?: string, attempts = 2) => {
	const page = getPage();
	for (let attempt = 0; attempt < attempts; attempt++) {
		await waitForSpinnerGone();
		// Bounded on purpose: this is a settle attempt, not a gate. waitForLoadState defaults to the
		// 60s navigationTimeout, and a page that never goes idle must not cost a minute per click.
		await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

		// Check the desired END STATE before dispatching, not only after. The previous version
		// documented this ("an already-open dialog is not opened twice") but did not do it: the
		// confirm was only ever read AFTER the dispatch, so a retry fired a second click into an
		// already-open dialog. `dispatchEvent` targets the element directly and ignores hit-testing,
		// so that second click reached the trigger THROUGH the dialog backdrop and re-ran the open
		// handler — which is why organization-tags saw `#inputName` pass its visibility check and
		// then vanish before `clear()` could act on it (failing all 3 CI attempts, so not a flake).
		//
		// This can only ever skip work that is already done: when the confirm target is absent the
		// behaviour below is unchanged.
		if (confirmSelector && (await loc(confirmSelector).first().isVisible().catch(() => false))) {
			return;
		}

		const target = loc(selector).first();
		await target.waitFor({ state: 'visible', timeout: defaultCommandTimeout });
		await target.dispatchEvent('click');
		if (!confirmSelector) return;
		try {
			await loc(confirmSelector).first().waitFor({ state: 'visible', timeout: 12_000 });
			return;
		} catch {
			/* the click was swallowed — settle and try again, re-checking the end state first. */
		}
	}
};

/**
 * Set an angular2-smart-table column filter and make it stick.
 *
 * The filter cell is
 *   `<input [value]="query" (change)="onValueChanged(...)" (keyup)="onValueChanged(...)">`
 * It never listens for 'input' — which is the only event `.fill()` dispatches — so a plain fill puts
 * text in the box and filters nothing: the grid keeps paging over every row and the record the spec
 * just created stays on page 2, never rendered and so never found. Typing character by character
 * instead races the debounced refetch, which writes `query` straight back into [value] and eats
 * keystrokes (a 27-character company name came out with 9 characters missing).
 *
 * So: fill the whole value in one shot, dispatch the 'change' the component actually subscribes to,
 * let the debounced refetch land, then read the value back and retry if a re-render clobbered it.
 */
export const applySmartTableFilter = async (selector: string, value: string, attempts = 4) => {
	const page = getPage();
	for (let attempt = 0; attempt < attempts; attempt++) {
		await waitForSpinnerGone();
		const input = loc(selector).first();
		await input.waitFor({ state: 'visible', timeout: defaultCommandTimeout });
		await input.fill(String(value));
		await input.dispatchEvent('change');
		await page.waitForTimeout(1200); // debounced refetch
		await waitForSpinnerGone();
		await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
		const current = await loc(selector)
			.first()
			.inputValue()
			.catch(() => '');
		if (current === String(value)) return;
	}
};

/**
 * Narrow a smart-table grid to the record this spec is about, so "my row exists" stops depending on
 * how much data earlier specs left behind.
 *
 * The grids are SERVER-paginated at 10 rows and the suite runs serially against ONE accumulating
 * database, so a row a spec just created is regularly not on page 1 at all. A bare
 * `verifyText(<tbody>, name)` then fails — not because the record is missing, but because it is on
 * page 2. That is precisely the kind of order-dependence that makes the failing set rotate between
 * runs, and it is what `remove-user` / `edit-user` were already fixed by filtering.
 *
 * Best-effort ON PURPOSE: not every grid has a filter row (several set `hideSubHeader` or mark all
 * columns `isFilterable: false`, and some screens are card grids, not tables). When the filter input
 * is not there this returns false and the caller asserts exactly as it did before — so adding this
 * call to an existing verification can only ever narrow the grid, never break it.
 *
 * Prefer a column-key selector (`th.angular2-smart-th.<columnKey> input`) over a
 * `[placeholder="…"]` one: the placeholder is the TRANSLATED column title, so it breaks the moment a
 * spec changes the UI language, while the column key is stable.
 */
export const scopeGridTo = async (filterSelector: string, value: string): Promise<boolean> => {
	await waitForSpinnerGone();
	try {
		await loc(filterSelector).first().waitFor({ state: 'visible', timeout: 6_000 });
	} catch {
		return false; // this grid has no filter row — leave the caller's behaviour untouched
	}
	await applySmartTableFilter(filterSelector, value);
	return true;
};

/**
 * Submit a dialog and PROVE it closed.
 *
 * "Click Save, then assert the row exists" is one of the ways this suite lies to itself. When the
 * click does not actually submit — the button was still disabled, the dispatch raced an async
 * valueChanges, an overlay swallowed it — the dialog simply stays open, and the following
 * `verifyXExists` is then satisfied by a LEFTOVER row that an earlier run created under the same
 * fixed test name. The spec goes green having saved nothing, and the next step opens a SECOND dialog
 * on top of the first, which is where it finally falls over (`strict mode violation: … resolved to 2
 * elements`) — several steps away from the real cause, and only when the previous run happened to
 * leave the right residue. That is exactly the shape of an order-dependent failure.
 *
 * So: wait for the button to be genuinely enabled (a dispatched click on a disabled button runs the
 * handler but the component's own guard then discards it), dispatch the click at the element so no
 * overlay can intercept it, and wait for the dialog host to DETACH. Re-dispatch if it is still there.
 * Returns whether the dialog actually closed.
 */
export const clickAndAwaitDialogClose = async (
	buttonSelector: string,
	dialogSelector: string,
	attempts = 3
): Promise<boolean> => {
	const page = getPage();
	const dialog = loc(dialogSelector).first();
	for (let attempt = 0; attempt < attempts; attempt++) {
		await waitForSpinnerGone();
		const button = loc(buttonSelector).first();
		await button.waitFor({ state: 'visible', timeout: defaultCommandTimeout }).catch(() => undefined);
		for (let i = 0; i < 12; i++) {
			if (await button.isEnabled().catch(() => false)) break;
			await page.waitForTimeout(500);
		}
		await button.dispatchEvent('click').catch(() => undefined);
		try {
			await dialog.waitFor({ state: 'detached', timeout: 12_000 });
			return true;
		} catch {
			/* still open — the submit did not take. Settle and try once more. */
		}
		await page.waitForTimeout(800);
	}
	return (await loc(dialogSelector).count().catch(() => 0)) === 0;
};

export const clickElementByText = async (selector: string, data: string) =>
	// force + taskTimeout to match clickButton: several flows leave a fading nb-dialog backdrop
	// (cdk-overlay-backdrop) that intercepts pointer events; the element is present and correct, the
	// click just needs to go through (Appointments "Book Public Appointment", etc.).
	(await optionAwareLoc(selector)).filter({ hasText: data }).first().click({ force: true, timeout: taskTimeout });

export const forceClickElementByText = async (selector: string, data: string) =>
	(await optionAwareLoc(selector)).filter({ hasText: data }).first().click({ force: true });

export const enterInput = async (selector: string, data: string) =>
	loc(selector).fill(String(data), { timeout: taskTimeout });

// In Cypress this was cy.wait(ms). Treat the arg as milliseconds.
export const wait = async (ms: number) => getPage().waitForTimeout(ms);
export const waitUntil = async (time: number) => getPage().waitForTimeout(time);

export const clearField = async (selector: string) => loc(selector).clear();

export const urlChanged = async (): Promise<string> => getPage().url();

export const verifyElementIsVisible = async (selector: string) =>
	// .first(): the Cypress original matched leniently; several current screens render the target
	// selector more than once (grid rows, tab headers, repeated nb components). Asserting on the
	// first match preserves the "is this control present?" intent without Playwright strict-mode
	// violations. Single-match selectors are unaffected.
	expect((await optionAwareLoc(selector)).first()).toBeVisible({ timeout: defaultCommandTimeout });

export const verifyElementIsVisibleByIndex = async (selector: string, index: number) =>
	expect((await optionAwareLoc(selector)).nth(index)).toBeVisible({ timeout: defaultCommandTimeout });

export const clickButtonByIndex = async (selector: string, index: number) =>
	// Option selectors are resolved to REAL options first: `nth(0)` on a bare `div.ng-option` is
	// ng-select's own "No items found" row whenever the list has not loaded, and clicking it is a
	// silent no-op. The index is unchanged for a populated list — ng-select only renders a placeholder
	// row when there are no real items at all.
	(await optionAwareLoc(selector)).nth(index).click({ force: true, timeout: taskTimeout });

export const clickOrganizationByIndex = async (selector: string, index: number) =>
	loc(selector).nth(index).click({ force: true, timeout: taskTimeout });

export const enterInputConditionally = async (selector: string, data: string) => {
	await loc(selector).fill(String(data), { timeout: taskTimeout });
	await loc(selector).press('Enter');
};

// keycode-based body keydown; map the common Enter/Escape, else best-effort.
export const clickKeyboardBtnByKeycode = async (keycode: number) => {
	const map: Record<number, string> = { 13: 'Enter', 27: 'Escape', 9: 'Tab', 32: 'Space' };
	await getPage().keyboard.press(map[keycode] ?? String.fromCharCode(keycode));
};

export const clickElementIfVisible = async (selector: string, index: number) => {
	const el = loc(selector);
	if (await el.first().isVisible()) {
		await el.nth(index).click();
	}
};

export const compareTwoTexts = async (selector: string, text: string) =>
	expect(loc(selector)).toContainText(text, { timeout: defaultCommandTimeout });

export const getLastElement = async (selector: string) => loc(selector).last().click();

export const doubleClickOnElement = async (selector: string, index: number) =>
	loc(selector).nth(index).dblclick();

export const getNotEqualElement = async (selector: string, text: string) =>
	expect(loc(selector)).not.toHaveText(text, { timeout: defaultCommandTimeout });

export const waitElementToHide = async (selector: string) => {
	// The unconditional 10s wait is load-bearing: it is not merely "wait for the toast to hide" but a
	// de-facto SETTLE that lets the grid refresh / navigation / valueChanges finish before the next step.
	// Replacing it with a bounded toast-poll regressed ~9 previously-green specs (add-user/clients/
	// customers/edit-user/… raced their next action). So keep the settle globally; the long send-cluster
	// scenarios instead get more budget via the per-test `timeout` in playwright.config.ts.
	await getPage().waitForTimeout(10_000);
	await expect(loc(selector)).toHaveCount(0, { timeout: defaultCommandTimeout });
};

export const clickButtonWithDelay = async (selector: string) => loc(selector).click();

export const clickButtonByText = async (text: string) =>
	getPage().locator('button', { hasText: text }).first().click({ force: true });

export const scrollDown = async (selector: string) =>
	loc(selector).evaluate((el) => el.scrollTo(0, el.scrollHeight));

export const scrollUp = async (selector: string) => loc(selector).evaluate((el) => el.scrollTo(0, 0));

export const scrollToViewEl = async (selector: string) => loc(selector).scrollIntoViewIfNeeded();

export const verifyElementIsNotVisible = async (selector: string) =>
	expect(loc(selector)).toBeHidden({ timeout: defaultCommandTimeout });

export const verifyElementNotExist = async (selector: string) =>
	expect(loc(selector)).toHaveCount(0, { timeout: defaultCommandTimeout });

export const verifyByText = async (selector: string, text: string) =>
	expect(await optionAwareLoc(selector)).toContainText(text, { timeout: defaultCommandTimeout });

export const clickByText = async (selector: string, text: string) =>
	(await optionAwareLoc(selector)).filter({ hasText: text }).first().click({ force: true, timeout: taskTimeout });

export const clickButtonMultipleTimes = async (selector: string, n: number) => {
	for (let i = 0; i < n; i++) {
		await loc(selector).click({ timeout: taskTimeout });
	}
};

export const typeOverTextarea = async (selector: string, text: string) =>
	loc(selector).fill(String(text), { timeout: taskTimeout });

// state is a cypress assertion fragment like 'be.visible'/'be.checked'/'be.disabled'.
export const verifyStateByIndex = async (selector: string, index: number, state: string) => {
	const el = loc(selector).nth(index);
	if (state.includes('not')) {
		if (state.includes('visible')) return expect(el).toBeHidden();
		if (state.includes('checked')) return expect(el).not.toBeChecked();
		if (state.includes('disabled')) return expect(el).toBeEnabled();
		return expect(el).toHaveCount(0);
	}
	if (state.includes('visible')) return expect(el).toBeVisible();
	if (state.includes('checked')) return expect(el).toBeChecked();
	if (state.includes('disabled')) return expect(el).toBeDisabled();
	if (state.includes('enabled')) return expect(el).toBeEnabled();
	return expect(el).toBeVisible();
};

export const verifyClassExist = async (selector: string, someClass: string) =>
	expect(loc(selector)).toHaveClass(new RegExp(someClass), { timeout: defaultCommandTimeout });

export const clickOutsideElement = async () => getPage().locator('body').click({ position: { x: 0, y: 0 } });

export const uploadMedia = async (selector: string, btn: string, file: string) => {
	await loc(selector).setInputFiles(file);
	await loc(btn).click({ force: true });
};

export const uploadMediaInput = async (selector: string, file: string) => loc(selector).setInputFiles(file);

export const waitElementToLoad = async (selector: string) =>
	expect((await optionAwareLoc(selector)).first()).toBeAttached({ timeout: defaultCommandTimeout });

export const dragNDrop = async (source: string, index: number, target: string) =>
	loc(source).nth(index).dragTo(loc(target));

// Cypress set a range slider to 35 via invoke('val',35)+trigger('change').
export const triggerSlider = async (selector: string) =>
	loc(selector)
		.first()
		.evaluate((el: HTMLInputElement) => {
			el.value = '35';
			el.dispatchEvent(new Event('change', { bubbles: true }));
		});

export const verifyTextContentByIndex = async (selector: string, data: string, index: number) =>
	expect(loc(selector).nth(index)).toContainText(data);

export const verifyElementIsNotVisibleByIndex = async (selector: string, index: number) =>
	expect(loc(selector).nth(index)).toBeHidden({ timeout: defaultCommandTimeout });

export const clickButtonWithForce = async (selector: string) =>
	(await optionAwareLoc(selector)).click({ force: true, timeout: taskTimeout });

export const verifyElementIfVisible = async (locOne: string, locTwo: string) => {
	if (await loc(locTwo).first().isVisible()) {
		await expect(loc(locOne)).toBeVisible({ timeout: defaultCommandTimeout });
	}
};

export const clickButtonDouble = async (selector: string) => loc(selector).dblclick({ timeout: taskTimeout });

export const waitForDropdownToLoad = async (selector: string) => {
	// Poll REAL options: a bare `div.ng-option` count includes ng-select's "No items found" placeholder,
	// so "the dropdown loaded" could be satisfied by an empty list. Strictly stricter — the raw count is
	// always >= the real count, so anything that satisfied this before still does.
	const resolved = await resolveOptionSelector(selector);
	return expect.poll(async () => loc(resolved).count(), { timeout: defaultCommandTimeout }).toBeGreaterThan(1);
};

export const clickButtonByIndexNoForce = async (selector: string, index: number) =>
	(await optionAwareLoc(selector)).nth(index).click({ timeout: taskTimeout });

export const enterTextInIFrame = async (selector: string, text: string) =>
	getPage().frameLocator(selector).locator('p').type(text);

export const verifyByLength = async (selector: string, length: number) =>
	expect(loc(selector)).toHaveCount(length, { timeout: defaultCommandTimeout });

export const enterInputByIndex = async (selector: string, data: string, index: number) =>
	loc(selector).nth(index).fill(String(data), { timeout: taskTimeout });

export const clearFieldByIndex = async (selector: string, index: number) => loc(selector).nth(index).clear();

// Fill a CKEditor 5 rich-text field. Forms bind e.g. [formControlName="description"] to a <ckeditor>
// host whose real editable is a nested contenteditable div (.ck-editor__editable), NOT an <input>, so
// enterInput/clearField (.fill()/.clear()) throw "Element is not an <input>, <textarea>...". Pass the
// ckeditor host (or any ancestor) selector; this clicks into the editable, clears it, and types text.
export const fillCkEditor = async (selector: string, text: string) => {
	const root = loc(selector).first();
	const inner = root.locator('.ck-editor__editable').first();
	const editable = (await inner.count()) > 0 ? inner : root;
	await editable.click({ timeout: taskTimeout });
	await getPage().keyboard.press('Control+A');
	await getPage().keyboard.press('Delete');
	await editable.pressSequentially(String(text), { timeout: taskTimeout });
};
