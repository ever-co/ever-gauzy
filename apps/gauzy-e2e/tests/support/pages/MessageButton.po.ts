import { verifyElementIsVisible, verifyText, waitForSpinnerGone } from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { MessageButton } from '../../../src/support/Base/pageobjects/MessageButtonPageObject';

/**
 * The support entries moved out of a header speech-bubble menu and into the Quick
 * Settings panel, so this page object drives that panel now.
 */

export const messageButtonVisible = async () => verifyElementIsVisible(MessageButton.toggleActionCss);

/**
 * Open Quick Settings.
 *
 * Identified by OUTCOME, not by selector: the trigger carries no distinguishing
 * attribute (see MessageButtonPageObject), and the changelog action sits beside it
 * wearing the same class. Clicking each candidate until the panel expands is stable
 * against icon changes, class changes and registration order — all of which have
 * moved at least once.
 *
 * Uses `dispatchEvent('click')` rather than a real click so the header's own
 * re-rendering cannot swallow it, and closes any wrong panel it opens before trying
 * the next candidate.
 */
export const clickMessageButton = async () => {
	const page = getPage();
	await waitForSpinnerGone();

	const candidates = page.locator(MessageButton.toggleActionCss);
	const panel = page.locator(MessageButton.panelCss).first();
	const count = await candidates.count();

	for (let i = 0; i < count; i++) {
		await candidates.nth(i).dispatchEvent('click');

		const opened = await panel
			.waitFor({ state: 'visible', timeout: 8_000 })
			.then(() => true)
			.catch(() => false);
		if (opened) return;

		// A timeout means "not visible YET" — it does not mean "wrong candidate".
		// Re-check once before concluding, because mistaking a slow render for the
		// wrong control and then clicking again would toggle the correctly-open
		// panel shut. (That is the same conflation this branch fixes in
		// `dispatchClickWhenSettled`; it must not be reintroduced here.)
		if (await panel.isVisible().catch(() => false)) return;

		// Only collapse when something ELSE actually opened — never blind-toggle the
		// candidate. If the click opened nothing, a second click could open it late,
		// leaving an unexpected overlay for the next candidate to be clicked through.
		const otherOpen = await page
			.locator('nb-sidebar.expanded:not(.settings-sidebar)')
			.count()
			.catch(() => 0);
		if (otherOpen > 0) {
			await candidates.nth(i).dispatchEvent('click').catch(() => undefined);
			await page.waitForTimeout(400);
		}
	}

	// Nothing opened it — fail with the assertion the caller expects rather than
	// silently continuing into a confusing text assertion.
	await verifyElementIsVisible(MessageButton.panelCss);
};

export const verifyTextExist = async (text: string) => verifyText(MessageButton.supportLinksCss, text);
