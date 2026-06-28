import { expect } from '@playwright/test';
import { getPage } from './page-context';

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

export const getTitle = async (): Promise<string> => getPage().title();

export const verifyText = async (selector: string, data: string) =>
	// Verify SOME element matching `selector` contains `data` (not necessarily the first). The earlier
	// .first().toContainText asserted only the first match, which fails the common "is X among the
	// rendered options/rows/cards?" check when X isn't first (dropdown options, grid rows, reused
	// headers). Filter by text then assert visibility — covers both the single-element and among-many
	// intents, retry-safe, and no Playwright strict-mode violation.
	expect(loc(selector).filter({ hasText: data }).first()).toBeVisible({ timeout: defaultCommandTimeout });

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
	loc(selector).first().click({ force: true, timeout: taskTimeout });

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

export const clickElementByText = async (selector: string, data: string) =>
	// force + taskTimeout to match clickButton: several flows leave a fading nb-dialog backdrop
	// (cdk-overlay-backdrop) that intercepts pointer events; the element is present and correct, the
	// click just needs to go through (Appointments "Book Public Appointment", etc.).
	loc(selector).filter({ hasText: data }).first().click({ force: true, timeout: taskTimeout });

export const forceClickElementByText = async (selector: string, data: string) =>
	loc(selector).filter({ hasText: data }).first().click({ force: true });

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
	expect(loc(selector).first()).toBeVisible({ timeout: defaultCommandTimeout });

export const verifyElementIsVisibleByIndex = async (selector: string, index: number) =>
	expect(loc(selector).nth(index)).toBeVisible({ timeout: defaultCommandTimeout });

export const clickButtonByIndex = async (selector: string, index: number) =>
	loc(selector).nth(index).click({ force: true, timeout: taskTimeout });

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
	expect(loc(selector)).toContainText(text, { timeout: defaultCommandTimeout });

export const clickByText = async (selector: string, text: string) =>
	loc(selector).filter({ hasText: text }).first().click({ force: true, timeout: taskTimeout });

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
	expect(loc(selector).first()).toBeAttached({ timeout: defaultCommandTimeout });

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
	loc(selector).click({ force: true, timeout: taskTimeout });

export const verifyElementIfVisible = async (locOne: string, locTwo: string) => {
	if (await loc(locTwo).first().isVisible()) {
		await expect(loc(locOne)).toBeVisible({ timeout: defaultCommandTimeout });
	}
};

export const clickButtonDouble = async (selector: string) => loc(selector).dblclick({ timeout: taskTimeout });

export const waitForDropdownToLoad = async (selector: string) =>
	expect.poll(async () => loc(selector).count(), { timeout: defaultCommandTimeout }).toBeGreaterThan(1);

export const clickButtonByIndexNoForce = async (selector: string, index: number) =>
	loc(selector).nth(index).click({ timeout: taskTimeout });

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
