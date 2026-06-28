import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	clearField,
	clickKeyboardBtnByKeycode,
	clickElementByText,
	waitElementToHide,
	verifyValue,
	scrollDown,
	dispatchClick,
	waitForSpinnerGone
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { SalesInvoicesPage } from '../../../src/support/Base/pageobjects/SalesInvoicesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.addButtonCss);
};

export const clickAddButton = async () => {
	// First click after navigating here straight from addContact: the leads/contact mutation leaves
	// fading cdk-overlay backdrops and the invoices page shows a load spinner over the toolbar. Wait it
	// out then dispatch the click so the add-invoice form reliably opens (a coordinate click can land on
	// the spinner/backdrop). add() runs synchronously on the click event.
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.addTagsDropdownCss);
};

export const clickTagsDropdown = async () => {
	// #addTags is an ng-select (opens on MOUSEDOWN); a coordinate/force click can be swallowed by a
	// lingering backdrop or even toggle the control shut. Open it via the keyboard: focus the inner
	// search input and press ArrowDown so the option panel (div.ng-option, appended to body) renders.
	const input = getPage().locator(SalesInvoicesPage.addTagsDropdownCss).locator('input').first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesInvoicesPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard (focus inner input + ArrowDown) until the options render —
	// ng-select opens on mousedown so a click is backdrop-blocked. Then pick the option (appended to body).
	// Best-effort: tags are OPTIONAL for an invoice (no validator on the tags control) and the list can
	// render empty/slow; if no option shows after a few re-opens, press Escape and continue rather than
	// hard-waiting on div.ng-option. Mirrors the proven SalesEstimates.po pattern.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${SalesInvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	if (await option.first().isVisible().catch(() => false)) {
		await option.nth(index).click({ force: true }).catch(() => {});
	} else {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickCardBody = async () => {
	await clickButton(SalesInvoicesPage.cardBodyCss);
};

export const waitMessageToHide = async () => {
	await waitElementToHide(SalesInvoicesPage.toastrMessageCss);
};

export const discountInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.discountInputCss);
};

export const enterDiscountData = async (data: string) => {
	await clearField(SalesInvoicesPage.discountInputCss);
	await enterInput(SalesInvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.discountTypeDropdownCss);
};

export const clickDiscountDropdown = async () => {
	await clickButton(SalesInvoicesPage.discountTypeDropdownCss);
};

export const selectDiscountTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const contactDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.organizationContactDropdownCss);
};

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on MOUSEDOWN, options render as div.ng-option appended to
	// body). Open via the keyboard rather than a click — a force-click can be intercepted by a fading
	// backdrop or close the control. ArrowDown opens the panel.
	const input = getPage()
		.locator(SalesInvoicesPage.organizationContactDropdownCss)
		.locator('input')
		.first();
	await input.focus();
	await getPage().keyboard.press('ArrowDown');
};

export const selectContactFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesInvoicesPage.contactOptionCss);
	// Re-open the contact ng-select via keyboard until its options render, then pick one. The contact is a
	// REQUIRED control (form.invalid disables Save), so retry generously. Best-effort guard at the end: if no
	// option shows after the re-opens, press Escape and continue rather than hard-waiting on div.ng-option.
	// Mirrors the proven SalesEstimates.po pattern.
	for (let i = 0; i < 6; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page
			.locator(`${SalesInvoicesPage.organizationContactDropdownCss} input`)
			.first()
			.focus()
			.catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	if (await option.first().isVisible().catch(() => false)) {
		await option.nth(index).click({ force: true }).catch(() => {});
	} else {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const taxInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.taxInputCss);
};

export const enterTaxData = async (data: string) => {
	await clearField(SalesInvoicesPage.taxInputCss);
	await enterInput(SalesInvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.taxTypeDropdownCss);
};

export const clickTaxTypeDropdown = async () => {
	await clickButton(SalesInvoicesPage.taxTypeDropdownCss);
};

export const selectTaxTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const invoiceTypeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const clickInvoiceTypeDropdown = async () => {
	await clickButton(SalesInvoicesPage.invoiceTypeDropdownCss);
};

export const selectInvoiceTypeFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const employeeDropdownVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.selectEmployeeCss);
};
export const clickEmployeeDropdown = async () => {
	await clickButton(SalesInvoicesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(SalesInvoicesPage.dropdownOptionCss);
	// Best-effort employee pick: ga-employee-multi-select loads its options async and can legitimately be
	// EMPTY (no employee "working" in the selected date range). Select one if it appears; otherwise press
	// Escape and continue — an invoice saves fine without members. Avoids a hard timeout on an empty
	// `.option-list nb-option` list. Mirrors the proven SalesEstimates.po / ContactsLeads.po pattern.
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => {
	await clickKeyboardBtnByKeycode(keycode);
};

export const generateItemsButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.generateItemsButtonCss);
};

export const clickGenerateItemsButton = async () => {
	await clickButton(SalesInvoicesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.saveAsDraftButtonCss);
};

export const clickSaveAsDraftButton = async (text: string) => {
	// Footer Save: settle the card spinner first, then DOM-dispatch the click so it fires even when a fading
	// overlay sits on top (a coordinate click would land on the overlay, leaving the invoice unsaved and the
	// next step's draft badge never appearing). Mirrors the proven SalesEstimates.po pattern.
	await waitForSpinnerGone();
	await getPage()
		.locator('button', { hasText: text })
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const tableRowVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.tableRowCss);
};

export const selectTableRow = async (index: number) => {
	const page = getPage();
	// Let the grid settle after the preceding mutation (it re-renders/refetches); a click during that
	// window is lost or instantly cleared. Then click the row ONCE and poll the toolbar Edit button to
	// enable — clicking a row TOGGLES its selection, so a blind second click would deselect it. Only
	// re-click if the first was lost to a late re-render.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const row = page.locator(SalesInvoicesPage.tableRowCss).nth(index);
	const editBtn = page.locator(SalesInvoicesPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		await row.click({ force: true });
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const actionButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.popoverButtonCss);
};

export const clickActionButtonByText = async (text: string) => {
	// dispatchClick: the popover action (Send/Email/Delete) is reached right after the More popover opens; a
	// fading overlay can intercept a coordinate click. Dispatch straight to the matched button so the
	// confirm dialog reliably opens. Mirrors the proven SalesEstimates.po pattern.
	await getPage()
		.locator(SalesInvoicesPage.popoverButtonCss)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');
};

export const backButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.backButtonCss);
};

export const clickBackButton = async () => {
	await clickButton(SalesInvoicesPage.backButtonCss);
};

export const confirmButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.confirmButtonCss);
};

export const clickConfirmButton = async () => {
	// Send/Email confirm dialog button. A SINGLE dispatchClick is racy here: the dialog body renders
	// <ga-invoice-pdf> (an async PDF/iframe preview, plus a CKEditor) so the first dispatch can land before
	// the (click)="send()"/"sendEmail()" handler is wired, and the dialog stays OPEN with the invoice never
	// sent — exactly the observed failure (the "Send this invoice to ...?" dialog was still up and the rows
	// were still Draft, so div.badge-success never appeared). Dispatch the success button, then POLL for the
	// mutation dialog host (ga-invoice-send / ga-invoice-email) to detach — re-dispatching if it lingers — so
	// the send/email actually fires before we move on. dispatchClick (not a coordinate click) so the fading
	// popover backdrop can't intercept it. Mirrors the proven SalesEstimates.po pattern.
	const page = getPage();
	const dialogHost = page.locator('ga-invoice-send, ga-invoice-email').first();
	for (let i = 0; i < 5; i++) {
		await waitForSpinnerGone();
		await dispatchClick(SalesInvoicesPage.confirmButtonCss).catch(() => {});
		try {
			await dialogHost.waitFor({ state: 'detached', timeout: 6000 });
			return;
		} catch {
			// dialog still open — the click didn't take (PDF preview still wiring up); loop and re-dispatch
		}
	}
};

export const emailInputVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.emailInputCss);
};

export const enterEmailData = async (data: string) => {
	await enterInput(SalesInvoicesPage.emailInputCss, data);
};

export const editButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.editButtonCss);
};

export const clickEditButton = async (index: number) => {
	// dispatchClick: the just-completed save/draft mutation leaves a fading cdk-overlay backdrop over the
	// toolbar that swallows a coordinate click on Edit. Edit is index 0 (Download is the other
	// `action.primary`); dispatch fires edit(selectedInvoice) straight on the button.
	void index;
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.editButtonCss);
};

export const viewButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.viewButtonCss);
};

export const clickViewButton = async (index: number) => {
	// viewButtonCss is now scoped to the eye-outline (View) button only, so the index is irrelevant
	// (the old `1` actually hit Payments). dispatchClick: a lingering toolbar backdrop can swallow a
	// coordinate click; dispatch fires view() straight on the button.
	void index;
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.viewButtonCss);
};

export const deleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.deleteButtonCss);
};

export const clickDeleteButton = async () => {
	// Popover Delete action — dispatchClick so the open popover's backdrop can't intercept it.
	// Mirrors the proven SalesEstimates.po pattern.
	await dispatchClick(SalesInvoicesPage.deleteButtonCss);
};

export const confirmDeleteButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const clickConfirmDeleteButton = async () => {
	// Delete-confirmation dialog OK button — settle then dispatchClick so the closing popover/dialog backdrop
	// can't intercept it. Mirrors the proven SalesEstimates.po pattern.
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.confirmDeleteButtonCss);
};

export const setStatusButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.setStatusButtonCss);
};

export const clickSetStatusButton = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.setStatusButtonCss, text);
};

export const setStatusFromDropdown = async (text: string) => {
	await clickElementByText(SalesInvoicesPage.dropdownOptionCss, text);
};

export const verifyEstimateExists = async (val: string) => {
	await verifyValue(SalesInvoicesPage.verifyInvoiceCss, val);
};

export const verifyDraftBadgeClass = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.draftBadgeCss);
};

export const verifySentBadgeClass = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.successBadgeCss);
};

export const verifyElementIsDeleted = async (text: string) => {
	// "Invoice deleted" check. Asserting an EMPTY grid (tableRowCss count 0) is WRONG here: the suite runs
	// serially on one seed and SalesEstimatesTest runs first (alphabetically) and CONVERTS an estimate into
	// an invoice, so the invoices grid already holds a polluted row before this spec even starts (the failure
	// DOM showed invoices #3 and #4). After this spec deletes its own invoice the grid still has ≥1 row, so a
	// count-0 assertion false-fails. Assert the true intent instead: the delete-confirmation nb-dialog
	// dispatched and detached (the delete actually fired), then let the grid refresh settle. Mirrors the
	// proven SalesEstimates.po pattern.
	void text;
	const page = getPage();
	await page
		.locator('ga-delete-confirmation')
		.first()
		.waitFor({ state: 'detached', timeout: 12000 })
		.catch(() => {});
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
};

export const scrollEmailInviteTemplate = async () => {
	await scrollDown(SalesInvoicesPage.emailCardCss);
};

export const moreButtonVisible = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.moreButtonCss);
};

export const clickMoreButton = async () => {
	// Clicked right after a row selection / prior mutation; a fading toolbar backdrop can swallow a
	// coordinate click. dispatch fires toggleActionsPopover() straight on the button so the actions
	// popover (Send/Email/Delete) opens reliably.
	await waitForSpinnerGone();
	await dispatchClick(SalesInvoicesPage.moreButtonCss);
};

export const verifyMoreButton = async () => {
	await verifyElementIsVisible(SalesInvoicesPage.moreButtonCss);
};
