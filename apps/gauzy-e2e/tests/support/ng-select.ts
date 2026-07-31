import { getPage } from './page-context';

/**
 * ONE place that knows how to drive an `<ng-select>`.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS — the `div.ng-option` placeholder trap
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * ng-select renders its own status rows with the SAME `ng-option` class as real choices:
 *
 *   @if (showNoItemsFound())   <div class="ng-option ng-option-disabled">No items found</div>
 *   @if (showTypeToSearch())   <div class="ng-option ng-option-disabled">Type to search</div>
 *   @if (loading() && …)       <div class="ng-option ng-option-disabled">Loading…</div>
 *
 * (verbatim from @ng-select/ng-select's dropdown template). So a bare `div.ng-option` selector is
 * satisfied by a panel that has loaded NOTHING:
 *
 *   • `count() > 0` / `toBeVisible()` on `div.ng-option` reports "the list is open and populated"
 *     while it is still empty, so the spec proceeds too early;
 *   • `.first()` / `.nth(i)` then CLICKS that placeholder — which is a no-op, because ng-select
 *     ignores clicks on disabled items. Nothing is selected, the form silently submits `null`, and
 *     the failure only surfaces several steps later as a missing row.
 *
 * That was proven on `recurring-expenses`: the POST came back 400 `"employeeId must be a string"`
 * with `employeeId: null`. Measured: opening the panel in the same tick the dialog appears can leave
 * it stuck on that placeholder for 5+ SECONDS — waiting longer does not fix it, but closing and
 * re-opening the panel picks the loaded list up immediately.
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * AND — the verification that validates itself
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * Unless the control sets `appendTo="body"`, ng-select renders the OPEN PANEL INSIDE the
 * `<ng-select>` element. So "read the control's text back and check it contains the option I just
 * clicked" is satisfied by the very panel that was clicked in — it reports success while nothing is
 * selected. The only honest proof of a commit is `div.ng-value`, which ng-select renders in the
 * value container and ONLY once a value is actually bound (single select: one node; multi select:
 * one per chip — see tags-color-input.component.html's ng-multi-label-tmp).
 *
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * HOW THIS DRIVES THE CONTROL
 * ────────────────────────────────────────────────────────────────────────────────────────────────
 * • Open via the KEYBOARD (focus the inner <input>, press ArrowDown), never a click on the host:
 *   ng-select opens on MOUSEDOWN and the host is routinely covered by a dialog/overlay backdrop, so
 *   a coordinate click — even `{ force: true }` — lands on the backdrop instead.
 * • Re-open by toggling the panel shut via its OWN `.ng-select-container`. NEVER press Escape:
 *   `nb-dialog` opens with `closeOnEsc`, so Escape dismisses the whole form the control sits in.
 * • Only `div.ng-option:not(.ng-option-disabled)` counts as a real option.
 * • Confirm against `div.ng-value` inside the control, never against the control's own text.
 */

/** How long a caller will wait for a real option before assuming the list is legitimately empty. */
const REAL_OPTION_GRACE = 8_000;

/**
 * Rewrite an option selector so ng-select's own disabled status rows ("No items found" / "Loading…"
 * / "Type to search") can never match.
 *
 * Operates on the `ng-option` CLASS TOKEN wherever it appears, so it survives every shape the suite
 * uses — `div.ng-option`, `ng-dropdown-panel > div.ng-dropdown-panel-items div.ng-option`,
 * `div.ng-option[role="option"]`, `div.ng-option > span.ng-option-label`, and comma-separated lists
 * that also carry unrelated `nb-option` branches (those are Nebular, and are left untouched).
 *
 * The two negative look-ahead assertions make it precise and idempotent:
 *  • `(?![\w-])`  — `.ng-option-label` / `.ng-option-selected` / `.ng-option-disabled` are DIFFERENT
 *                   classes and must not be rewritten;
 *  • `(?!:not\(…)` — an already-hardened selector is returned unchanged, so applying this twice
 *                   (helper + util layer) is safe.
 */
export const realOptionSelector = (selector: string): string =>
	selector.replace(/\.ng-option(?![\w-])(?!:not\(\.ng-option-disabled\))/g, '.ng-option:not(.ng-option-disabled)');

/** Does this selector address ng-select options at all? (Nebular `nb-option` selectors do not.) */
export const isNgOptionSelector = (selector: string): boolean => realOptionSelector(selector) !== selector;

/** Locator for the REAL options of an ng-select — placeholders excluded. */
export const realOptions = (optionSelector: string) => getPage().locator(realOptionSelector(optionSelector));

/**
 * Resolve an option selector to its placeholder-free form — but only once a real option has actually
 * rendered.
 *
 * This is the zero-knowledge variant used by the shared util layer, which is handed an option
 * selector with no idea which control produced it. It is STRICTLY more robust than the raw selector:
 * when the list populates (the overwhelmingly common case) every caller is now pinned to real
 * options; when the list is legitimately empty it hands back the ORIGINAL selector, so behaviour is
 * byte-for-byte what it was before. It can therefore never turn a passing step into a failing one.
 */
export const resolveOptionSelector = async (selector: string, timeout = REAL_OPTION_GRACE): Promise<string> => {
	const hardened = realOptionSelector(selector);
	if (hardened === selector) {
		return selector; // not an ng-select option selector — nothing to do
	}
	try {
		await getPage().locator(hardened).first().waitFor({ state: 'attached', timeout });
		return hardened;
	} catch {
		return selector; // no real option ever came — fall back to the pre-existing behaviour
	}
};

/** The COMMITTED values of an ng-select: `div.ng-value` exists only once a value is really bound. */
export const committedValues = (controlSelector: string) =>
	getPage().locator(controlSelector).first().locator('div.ng-value');

/**
 * What the CLOSED control displays — the selected value(s) or, when nothing is selected, the
 * placeholder.
 *
 * Use this instead of reading the `<ng-select>` element's own text. ng-select's markup is
 *
 *   <ng-select>
 *     <div class="ng-select-container"> … ng-value / ng-placeholder … </div>
 *     <ng-dropdown-panel> … ng-option … </ng-dropdown-panel>   <!-- only when NOT appendTo="body" -->
 *   </ng-select>
 *
 * so the host's text includes the OPEN OPTION LIST, and a "does the control show X?" check is then
 * satisfied by an option in the panel rather than by anything committed. `.ng-select-container` is a
 * sibling of the panel, so it is never contaminated — whether or not the control sets appendTo.
 */
export const controlText = async (controlSelector: string): Promise<string> =>
	(await getPage()
		.locator(controlSelector)
		.first()
		.locator('.ng-select-container')
		.first()
		.innerText()
		.catch(() => '')) || '';

/**
 * Open an ng-select and wait until it holds at least one REAL option.
 *
 * Returns whether real options are present, so callers can distinguish "the list loaded" from "the
 * list is genuinely empty" instead of clicking blindly into a placeholder.
 */
export const openNgSelect = async (controlSelector: string, optionSelector: string, attempts = 5): Promise<boolean> => {
	const page = getPage();
	const control = page.locator(controlSelector).first();
	const input = control.locator('input').first();
	const container = control.locator('.ng-select-container').first();
	const options = realOptions(optionSelector);
	const count = async () => options.count().catch(() => 0);

	for (let i = 0; i < attempts; i++) {
		if (await count()) {
			return true;
		}
		// Keyboard, not a click: ng-select opens on mousedown and the host is often under a backdrop.
		await input.focus().catch(() => undefined);
		await page.keyboard.press('ArrowDown').catch(() => undefined);
		await page.waitForTimeout(700);
		if (await count()) {
			return true;
		}
		// Still on the placeholder. Waiting does not help (measured: 5s+); a shut/re-open does. Toggle via
		// the control's OWN container — NEVER Escape, which would close the surrounding nb-dialog.
		await container.click({ force: true }).catch(() => undefined);
		await page.waitForTimeout(500);
	}
	return (await count()) > 0;
};

/**
 * Pick an option and PROVE it committed.
 *
 * `target` is either the option text (matched against real options only) or an index INTO THE REAL
 * options — which is the same index as before whenever the list is populated, because ng-select only
 * renders a placeholder row when there are no real items at all.
 *
 * Commit is confirmed against `div.ng-value` — a new chip appeared, or a chip carrying the option's
 * text exists — never by reading the control's text back (see the file header). Selection is
 * re-checked BEFORE every retry so a multi-select is never toggled back off by a second click.
 *
 * Best-effort by design (returns false rather than throwing): several of these dropdowns are
 * optional fields whose list can legitimately be empty, and the callers that DO require a value
 * assert on the saved record afterwards. What it never does is silently click a placeholder.
 */
export const selectNgOption = async (
	controlSelector: string,
	optionSelector: string,
	target: string | number,
	options: { search?: string; attempts?: number } = {}
): Promise<boolean> => {
	const page = getPage();
	const attempts = options.attempts ?? 3;
	const values = committedValues(controlSelector);
	const input = page.locator(controlSelector).first().locator('input').first();
	const baseline = await values.count().catch(() => 0);

	let wanted = typeof target === 'string' ? target : '';
	const committed = async (): Promise<boolean> => {
		const now = await values.count().catch(() => 0);
		if (now > baseline) {
			return true; // a new chip/value node appeared
		}
		if (wanted) {
			// Single select replacing an existing value keeps the count at 1 — match on the text instead.
			return (
				(await values
					.filter({ hasText: wanted })
					.count()
					.catch(() => 0)) > 0
			);
		}
		return false;
	};

	for (let attempt = 0; attempt < attempts; attempt++) {
		if (await committed()) {
			return true;
		}
		if (!(await openNgSelect(controlSelector, optionSelector))) {
			continue; // list never populated — re-open and look again rather than clicking a placeholder
		}
		if (options.search) {
			// Typeahead filter. ng-select does NOT re-run its filter against items that arrive later (the
			// search term is sticky), so this must happen AFTER openNgSelect has proven the list loaded.
			await input.fill('').catch(() => undefined);
			await input.pressSequentially(options.search, { delay: 20 }).catch(() => undefined);
			await page.waitForTimeout(400);
		}
		const list = realOptions(optionSelector);
		const option = typeof target === 'string' ? list.filter({ hasText: target }).first() : list.nth(target);
		if ((await option.count().catch(() => 0)) === 0) {
			continue;
		}
		if (!wanted) {
			wanted = ((await option.textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();
		}
		// DOM-level click for the first try: ng-select binds `(click)="toggleItem(item)"` on the option, so
		// dispatching the event straight at it fires the handler and CANNOT be intercepted. A coordinate
		// click — even `{ force: true }`, which only skips the actionability check — is still delivered at
		// screen coordinates, and when the body-appended panel sits over an nb-dialog's cdk-overlay-backdrop
		// that click can land on the backdrop and dismiss the whole form. Fall back to a real click on later
		// attempts in case a handler needs genuine pointer events.
		if (attempt === 0) {
			await option.dispatchEvent('click').catch(() => undefined);
		} else {
			await option.click({ force: true }).catch(() => undefined);
		}
		await page.waitForTimeout(600);
		if (await committed()) {
			return true;
		}
		await page.waitForTimeout(800); // slow bind (async valueChanges) — give it one more look before retrying
		if (await committed()) {
			return true;
		}
	}
	return committed();
};
