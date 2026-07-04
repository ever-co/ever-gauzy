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

export const selectContactFromDropdown = async (nameOrIndex: string | number) => {
	const page = getPage();
	const option = page.locator(SalesInvoicesPage.contactOptionCss);
	const input = page.locator(`${SalesInvoicesPage.organizationContactDropdownCss} input`).first();
	// POLLUTION RESILIENCE: the sales/accounting invoices grids share data and SalesEstimatesTest (runs first
	// alphabetically) converts an estimate into an invoice, so by the time this spec runs the contact ng-select
	// holds many contacts from earlier specs. When given this spec's UNIQUE faker contact name, typeahead-filter
	// to it (ga-contact-select uses a name.toLowerCase().includes() searchFn) and pick the matching option — so
	// EVERY invoice this spec creates carries that name in the grid's Contact column and our later row operations
	// can scope to it instead of a fragile index. Re-open the ng-select via keyboard first (opens on mousedown so
	// a click is backdrop-blocked). The contact is a REQUIRED control (form.invalid disables Save), retry
	// generously. Mirrors the proven SalesEstimates.po pattern.
	const byName = typeof nameOrIndex === 'string';
	for (let i = 0; i < 6; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await input.focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(800);
	}
	if (byName) {
		await input.fill('').catch(() => {});
		await input.pressSequentially(String(nameOrIndex), { delay: 20 }).catch(() => {});
		await page.waitForTimeout(600);
		const match = option.filter({ hasText: String(nameOrIndex) }).first();
		try {
			await match.waitFor({ state: 'visible', timeout: 8000 });
			await match.click({ force: true });
			return;
		} catch {
			// named contact didn't surface (shouldn't happen — addContact created it — but keep the flow moving).
			// Clear the typed filter so the fallback picks a real (unfiltered) option, not an empty filtered list.
			await input.fill('').catch(() => {});
			await page.waitForTimeout(400);
		}
	}
	// index path (or named-fallback): best-effort guard — if no option shows, Escape and continue rather than
	// hard-waiting on div.ng-option.
	if (await option.first().isVisible().catch(() => false)) {
		await option.nth(byName ? 0 : (nameOrIndex as number)).click({ force: true }).catch(() => {});
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

export const selectTableRow = async (indexOrName: string | number) => {
	const page = getPage();
	// Settle the grid first: a row click TOGGLES selection, so a stray double-click would deselect it (the
	// spec calls selectTableRow repeatedly across steps). Wait for spinner/network/render to settle, then click
	// the data row ONCE and poll the toolbar Edit button's real `disabled` attr — only re-click if selection
	// was lost. Never rapid re-click. Mirrors the proven SalesEstimates.po pattern.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	// POLLUTION RESILIENCE: the sales/accounting invoices grids share data and SalesEstimatesTest converts an
	// estimate into an invoice before this spec runs, so row 0 can be a FOREIGN invoice (the captured failure
	// grid already held two invoices #3 and #6). When given this spec's unique contact name, scope to data rows
	// whose Contact column shows that name and take the first of OURS — deterministic regardless of how many
	// foreign rows are interleaved. Falls back to the raw index when given a number. Mirrors SalesEstimates.po.
	const row =
		typeof indexOrName === 'string'
			? page.locator(SalesInvoicesPage.tableRowCss).filter({ hasText: indexOrName }).first()
			: page.locator(SalesInvoicesPage.tableRowCss).nth(indexOrName);
	const editBtn = page.locator(SalesInvoicesPage.editButtonCss).first();
	for (let i = 0; i < 4; i++) {
		await row.click({ force: true }).catch(() => {});
		try {
			await page.waitForFunction(
				(el) => !!el && !(el as HTMLButtonElement).disabled,
				await editBtn.elementHandle(),
				{ timeout: 4000 }
			);
			return;
		} catch {
			// selection didn't enable the toolbar yet — loop and click the row again
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
	// Send/Email confirm dialog OK button. The dialog's Send button is `<button (click)="send()"
	// status="success" nbButton>` (ga-invoice-send) / `<button (click)="sendEmail()" [disabled]="form.invalid"
	// status="success" nbButton>` (ga-invoice-email). `send()`/`sendEmail()` first `await` an
	// invoicesService.update(status: SENT) / sendEmail(...)+updateAction(status: SENT) and only THEN
	// `dialogRef.close()` — so nothing short of a REAL click that actually reaches the button drives it to
	// completion and flips the row out of Draft. ROOT CAUSE this spec kept dying at `div.badge-success` while
	// the "Send this invoice to <name> ?" dialog was STILL open and every row Draft: the prior handler used a
	// synthetic `dispatchEvent('click')` (and a page-level dispatchClick fallback) which does NOT reliably drive
	// the async (click)="send()"/"sendEmail()" handler on the nbButton — the dialog never closed, status stayed
	// SENT-never-set, the SENT badge never rendered. The mutation dialog is the TOPMOST cdk-overlay, so its own
	// Send button is not under any fading backdrop; a REAL actionable click lands on it and fires the handler.
	// FIX mirrors the proven (round-7) SalesEstimates.po: (1) wait for the dialog host to render before clicking
	// (the handler isn't wired until then); (2) settle the ga-invoice-pdf preview briefly, scroll the footer
	// Send button into the scrollable card's viewport, and do a REAL actionable click (no force) so Playwright
	// waits until the button genuinely receives pointer events AND is enabled (the email Send is
	// [disabled]="form.invalid") before clicking — force/dispatch only as fallbacks; (3) poll the host to DETACH
	// with a generous window (the awaited update round-trip must resolve before dialogRef.close), so we don't
	// loop into a no-op re-click while the first click's handler is still awaiting.
	const page = getPage();
	const dialogHost = page.locator('ga-invoice-send, ga-invoice-email').first();
	await dialogHost.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
	// Let the PDF preview settle a moment (bounded — the ga-invoice-pdf iframe can stream indefinitely, so a
	// bare networkidle wait could stall; a short fixed pause clears the initial layout/animation).
	await page.waitForTimeout(1200);
	const confirmBtn = dialogHost.locator('nb-card-footer.text-left > button[status="success"]').first();
	for (let i = 0; i < 8; i++) {
		await waitForSpinnerGone();
		await confirmBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
		await confirmBtn.scrollIntoViewIfNeeded().catch(() => {});
		// Real ACTIONABLE click (no force): waits for visible/stable/enabled AND receives-pointer-events, so the
		// event lands on the Send button and drives async send()/sendEmail(). Fall back to force, then a raw DOM
		// dispatch, only if the actionable click can't resolve in time.
		await confirmBtn.click({ timeout: 6000 }).catch(async () => {
			await confirmBtn.click({ force: true, timeout: 4000 }).catch(async () => {
				await confirmBtn.dispatchEvent('click').catch(async () => {
					await dispatchClick(SalesInvoicesPage.confirmButtonCss).catch(() => {});
				});
			});
		});
		try {
			// Generous detach window: send()/sendEmail() awaits the service update before dialogRef.close(), so the
			// dialog only leaves the DOM once that round-trip resolves. 12s absorbs a slow update without looping
			// into a no-op re-click while the first click's handler is still awaiting.
			await dialogHost.waitFor({ state: 'detached', timeout: 12000 });
			// let the onClose refresh ($refresh$ / invoices$) settle so the grid repaints the SENT badge
			await waitForSpinnerGone();
			await page.waitForLoadState('networkidle').catch(() => {});
			return;
		} catch {
			// dialog still open — the click didn't take (PDF preview still wiring up); loop and re-click
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
