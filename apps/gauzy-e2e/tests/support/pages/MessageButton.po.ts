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
	const count = await candidates.count();

	for (let i = 0; i < count; i++) {
		await candidates.nth(i).dispatchEvent('click');
		try {
			await page.locator(MessageButton.panelCss).first().waitFor({ state: 'visible', timeout: 6_000 });
			return;
		} catch {
			// Wrong panel (or none). Collapse whatever opened so the next candidate is
			// not clicked through an open overlay, then continue.
			await candidates.nth(i).dispatchEvent('click').catch(() => undefined);
			await page.waitForTimeout(400);
		}
	}

	// Nothing opened it — fail with the assertion the caller expects rather than
	// silently continuing into a confusing text assertion.
	await verifyElementIsVisible(MessageButton.panelCss);
};

export const verifyTextExist = async (text: string) => verifyText(MessageButton.supportLinksCss, text);
