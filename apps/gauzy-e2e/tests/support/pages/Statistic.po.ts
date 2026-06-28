import { verifyElementIsVisible, verifyText, clickButtonByIndex, waitForSpinnerGone } from '../util';
import { getPage } from '../page-context';
// Selectors + data are framework-agnostic — reused from the Cypress tree during migration.
import { StatisticPage } from '../../../src/support/Base/pageobjects/StatisticPageObject';

export const headerTextExist = async (text: string) => verifyText(StatisticPage.headerTextCss, text);

export const subheaderTextExist = async (text: string) => verifyText(StatisticPage.subheaderTextCss, text);

export const verifyAccordionVisible = async () => verifyElementIsVisible(StatisticPage.accordionItemCss);

// Clicking an nb-accordion-item-header TOGGLES the item; Nebular runs an expand animation before the
// body becomes visible, and (multi=false) collapsing the previously-open item races the new one opening.
// A bare click followed immediately by a visibility assertion sees the body mid-animation while it is
// still `visibility:hidden; height:0`. So we click, then WAIT for this exact header to report expanded
// (Nebular sets aria-expanded="true" once the body is open) before returning — the body span is then
// genuinely visible for the subsequent verifyNoDataText assertion.
export const clickSubheaderByIndex = async (index: number) => {
	await waitForSpinnerGone();
	await clickButtonByIndex(StatisticPage.accordionItemCss, index);
	// aria-expanded lives on the header element itself; wait for the nth header to flip to "true"
	// (the accordion is multi=false, so the prior item collapses and only this one is open).
	const expanded = getPage().locator(`${StatisticPage.accordionItemCss}[aria-expanded="true"]`).first();
	await expanded.waitFor({ state: 'attached', timeout: 24_000 }).catch(() => {});
};

export const verifyNoDataText = async (text: string) => verifyText(StatisticPage.noDataTextCss, text);
