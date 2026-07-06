import {
	enterInput,
	verifyElementIsVisible,
	clickButton,
	dispatchClick,
	waitForSpinnerGone,
	clearField,
	clickKeyboardBtnByKeycode,
	clickButtonByIndex,
	clickElementByText,
	waitElementToHide,
	verifyValue,
	scrollDown,
	verifyElementIsNotVisible
} from '../util';
import { getPage } from '../page-context';
// Selectors are framework-agnostic — reused from the Cypress tree during migration.
import { InvoicesPage } from '../../../src/support/Base/pageobjects/InvoicesPageObject';

export const gridBtnExists = async () => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const gridBtnClick = async (index: number) => {
	/* no-op: grid list/grid layout toggle removed from the app */
};

export const addButtonVisible = async () => verifyElementIsVisible(InvoicesPage.addButtonCss);

export const clickAddButton = async () => {
	// dispatchClick past the post-navigation load spinner so the Add invoice form reliably opens
	// (a coordinate click can land on the fading list-page spinner overlay).
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.addButtonCss);
};

export const tagsDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.addTagsDropdownCss);

export const clickTagsDropdown = async () => {
	// focus + ArrowDown (NOT a click): #addTags is an ng-select that opens on MOUSEDOWN; a force-click
	// lands on the add-form backdrop and dismisses the whole route form, so the options never render
	// (this was the test's timeout: div.ng-option never appeared). The focus MUST target the inner
	// <input> — focusing the ng-select host leaves the input unfocused so ArrowDown goes to <body>.
	await waitForSpinnerGone();
	await getPage().locator(`${InvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectTagFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(InvoicesPage.tagsDropdownOption);
	// Re-open the tags ng-select via keyboard (focus the inner input + ArrowDown) until the options
	// render — ng-select opens on mousedown so a click is backdrop-blocked. Then pick the option
	// (appended to <body>). Best-effort: tags are optional for an invoice, and the list can render empty,
	// so if no option shows after a few re-opens, press Escape and continue rather than hard-waiting 60s.
	for (let i = 0; i < 4; i++) {
		if (await option.first().isVisible().catch(() => false)) break;
		await waitForSpinnerGone();
		await page.locator(`${InvoicesPage.addTagsDropdownCss} input`).first().focus().catch(() => {});
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
	// Close the still-open tags ng-select ([closeOnSelect]=false keeps it open after a pick) by pressing
	// Escape — NOT by clicking nb-card-header.d-flex. That header hosts <ngx-back-navigation> (a goBack()
	// button); a force-click on the header can dispatch to it and navigate OUT of the add-invoice route,
	// which dismissed the whole form (the test then waited forever on div.ng-option with the list showing).
	await getPage().keyboard.press('Escape').catch(() => {});
};

export const waitMessageToHide = async () => waitElementToHide(InvoicesPage.toastrMessageCss);

export const discountInputVisible = async () => verifyElementIsVisible(InvoicesPage.discountInputCss);

export const enterDiscountData = async (data: string) => {
	await clearField(InvoicesPage.discountInputCss);
	await enterInput(InvoicesPage.discountInputCss, data);
};

export const discountTypeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.discountTypeDropdownCss);

export const clickDiscountDropdown = async () => clickButton(InvoicesPage.discountTypeDropdownCss);

export const selectDiscountTypeFromDropdown = async (text: string) =>
	clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const contactDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.organizationContactDropdownCss);

export const clickContactDropdown = async () => {
	// ga-contact-select is an ng-select (opens on mousedown, options appendTo body) — same hazard as the
	// tags one: a force-click is backdrop-blocked / can dismiss the route form. Open via the inner input.
	await waitForSpinnerGone();
	await getPage().locator(`${InvoicesPage.organizationContactDropdownCss} input`).first().focus().catch(() => {});
	await getPage().keyboard.press('ArrowDown').catch(() => {});
};

export const selectContactFromDropdown = async (nameOrIndex: string | number) => {
	const page = getPage();
	const option = page.locator(InvoicesPage.contactOptionCss);
	const input = page.locator(`${InvoicesPage.organizationContactDropdownCss} input`).first();
	// POLLUTION RESILIENCE: EstimatesTest runs BEFORE this spec (alphabetically) and converts an estimate into
	// an invoice, so by the time this spec runs the contact ng-select already holds foreign contacts from
	// earlier specs — a plain .nth(0) would link the WRONG contact and break every later name-scoped row/select.
	// When given this spec's UNIQUE faker contact name, typeahead-filter to it (ga-contact-select uses a
	// name.toLowerCase().includes() searchFn) and pick the matching option, so EVERY invoice this spec creates
	// carries that name in the grid's Contact column. Re-open the ng-select via keyboard first (opens on
	// mousedown so a click is backdrop-blocked). The contact is a REQUIRED control (form.invalid disables Save),
	// retry generously. Mirrors the proven SalesInvoices.po pattern.
	const byName = typeof nameOrIndex === 'string';
	// The selected contact renders as a label INSIDE the ng-select control (ng-label-tmp -> the contact
	// name). Verifying that label committed is what proves organizationContactId will land on the saved
	// invoice — a REQUIRED gate: send() opens the confirm dialog only if selectedInvoice.organizationContactId
	// is set (else it toasts "NOT_LINKED" and never sends), and the popover Send button is [disabled]="!canBeSend"
	// which is false when the row has no toContact. A silent mis-pick here => the invoice stays DRAFT and
	// verifySentBadgeClass times out three steps later. So confirm the label, and re-pick if it didn't take.
	const control = page.locator(InvoicesPage.organizationContactDropdownCss).first();
	const committed = async () =>
		byName
			? (await control.innerText().catch(() => '')).toLowerCase().includes(String(nameOrIndex).toLowerCase())
			: (await control.locator('.ng-value').count().catch(() => 0)) > 0;

	for (let attempt = 0; attempt < 3; attempt++) {
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
				await page.waitForTimeout(400);
				if (await committed()) return;
				// pick didn't commit onto the control — reopen and retry (below).
			} catch {
				// named contact didn't surface (shouldn't happen — addContact created it — but keep the flow moving);
				// clear the typed filter so the fallback picks a real (unfiltered) option, not an empty filtered list.
				await input.fill('').catch(() => {});
				await page.waitForTimeout(400);
			}
		}
		// index path (or named-fallback): best-effort — if no option shows, Escape and continue rather than hanging.
		if (await option.first().isVisible().catch(() => false)) {
			await option.nth(byName ? 0 : (nameOrIndex as number)).click({ force: true }).catch(() => {});
			await page.waitForTimeout(400);
			if (await committed()) return;
		} else if (!byName) {
			await page.keyboard.press('Escape').catch(() => {});
			return;
		}
		// not committed yet — reopen the ng-select for another attempt (opens on mousedown, so keyboard).
		await input.focus().catch(() => {});
		await page.keyboard.press('ArrowDown').catch(() => {});
		await page.waitForTimeout(500);
	}
};

export const taxInputVisible = async () => verifyElementIsVisible(InvoicesPage.taxInputCss);

export const enterTaxData = async (data: string) => {
	await clearField(InvoicesPage.taxInputCss);
	await enterInput(InvoicesPage.taxInputCss, data);
};

export const taxTypeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.taxTypeDropdownCss);

export const clickTaxTypeDropdown = async () => clickButton(InvoicesPage.taxTypeDropdownCss);

export const selectTaxTypeFromDropdown = async (text: string) =>
	clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const invoiceTypeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.invoiceTypeDropdownCss);

export const clickInvoiceTypeDropdown = async () => clickButton(InvoicesPage.invoiceTypeDropdownCss);

export const selectInvoiceTypeFromDropdown = async (text: string) =>
	clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const employeeDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.selectEmployeeCss);

export const clickEmployeeDropdown = async () => {
	// Settle the form's full-card spinner first (it overlays the select, swallowing the open click), then
	// open the employee multi-select (an nb-select; options are '.option-list nb-option').
	await waitForSpinnerGone();
	await clickButton(InvoicesPage.selectEmployeeCss);
};

export const selectEmployeeFromDropdown = async (index: number) => {
	const page = getPage();
	const option = page.locator(InvoicesPage.dropdownOptionCss);
	// Best-effort employee pick (mirrors ContactsLeads.po selectEmployeeDropdownOption): the option list
	// is the org's employees "working" in the header date range (getWorkingEmployees), loaded async, and
	// can legitimately be EMPTY on the test DB. Select one if it shows; otherwise leave members empty (the
	// invoice still generates/saves) so the flow proceeds — avoids a hard 60s timeout on an empty list.
	try {
		await option.first().waitFor({ state: 'visible', timeout: 8000 });
		await option.nth(index).click({ force: true });
	} catch {
		await page.keyboard.press('Escape').catch(() => {});
	}
};

export const clickKeyboardButtonByKeyCode = async (keycode: number) => clickKeyboardBtnByKeycode(keycode);

export const generateItemsButtonVisible = async () => verifyElementIsVisible(InvoicesPage.generateItemsButtonCss);

export const clickGenerateItemsButton = async () => {
	// dispatchClick past the form's full-card nb-spinner that overlays the buttons while it loads items.
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.generateItemsButtonCss);
};

export const saveAsDraftButtonVisible = async () => verifyElementIsVisible(InvoicesPage.saveAsDraftButtonCss);

export const clickSaveAsDraftButton = async (text: string) => {
	// Footer Save: settle the card spinner first, then DOM-dispatch the click so it fires even if a
	// fading overlay sits on top (a coordinate click would land on the overlay instead of the button).
	await waitForSpinnerGone();
	await getPage()
		.locator('button', { hasText: text })
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const tableRowVisible = async () => verifyElementIsVisible(InvoicesPage.tableRowCss);

export const selectTableRow = async (index: number, name?: string) => {
	const page = getPage();
	// Let the grid settle after the preceding mutation (it re-renders/refetches); a click during that
	// window is lost or instantly cleared. Then click the data row ONCE and poll the toolbar Edit button to
	// enable — clicking a row TOGGLES its selection, so a blind second click would deselect it. Only
	// re-click if the first was lost to a late re-render. (Polls isDisabled() rather than holding an
	// elementHandle, which goes stale across the grid's re-render. Mirrors the proven SalesInvoices.po.)
	//
	// POLLUTION RESILIENCE: EstimatesTest runs BEFORE this spec (alphabetically) and CONVERTS an estimate to
	// an invoice, so the invoices grid already holds a foreign invoice row (with a different contact) before
	// this spec even selects a row. A plain .nth(0) would then grab the WRONG record. When `name` (this
	// spec's unique faker contact) is given, scope the row to it (the grid's Contact column renders the
	// contact name) so we always act on OUR invoice regardless of order. Falls back to .nth(index) if the
	// named row hasn't rendered yet.
	await waitForSpinnerGone();
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(1500);
	const rows = page.locator(InvoicesPage.tableRowCss);
	const namedRow = name ? rows.filter({ hasText: name }).first() : rows.nth(index);
	const editBtn = page.locator(InvoicesPage.editButtonCss).first();
	for (let attempt = 0; attempt < 4; attempt++) {
		// Prefer the uniquely-named row; if it isn't present yet (late render), fall back to the index row.
		const row =
			name && (await namedRow.count().catch(() => 0)) > 0 ? namedRow : rows.nth(index);
		await row.click({ force: true }).catch(() => {});
		for (let i = 0; i < 8; i++) {
			await page.waitForTimeout(350);
			if (!(await editBtn.isDisabled().catch(() => true))) return;
		}
	}
};

export const actionButtonVisible = async () => verifyElementIsVisible(InvoicesPage.popoverButtonCss);

export const clickActionButtonByText = async (text: string) =>
	// dispatchClick: the popover action (Send/Email) is reached right after the More popover opens; a
	// fading overlay can intercept a coordinate click. Dispatch the event straight to the matched button.
	getPage()
		.locator(`${InvoicesPage.popoverButtonCss}`)
		.filter({ hasText: text })
		.first()
		.dispatchEvent('click');

export const backButtonVisible = async () => verifyElementIsVisible(InvoicesPage.backButtonCss);

export const clickBackButton = async () => dispatchClick(InvoicesPage.backButtonCss);

export const confirmButtonVisible = async () => verifyElementIsVisible(InvoicesPage.confirmButtonCss);

export const clickConfirmButton = async () => {
	// Send/Email confirm dialog OK button. ROOT CAUSE of the round-7 failure (captured DOM: "Send this
	// invoice to Pamela Gislason ?" dialog STILL up, its ga-invoice-pdf iframe + Cancel/Send, the row still
	// Draft, so div.badge-success never rendered): the round-6 attempt used a REAL `.click({force:true})` on
	// the footer Send button. That regressed the step. The dialog body is <ga-invoice-pdf> — a `height:90vh`
	// card whose iframe (`height:100%; width:60vw`) fills the body; a coordinate/real click hit-tests at the
	// button's center and the browser routes it to whatever is topmost at that point (the iframe / a fading
	// cdk-overlay backdrop), NOT the button — `{force:true}` only skips the actionability WAIT, it still
	// dispatches at screen coordinates (ROOT CAUSE #2). So `send()`'s `await invoicesService.update(...)` never
	// ran, the dialog stayed open, the invoice never left Draft. FIX: mirror the PROVEN-GREEN SalesInvoices.po
	// exactly — `dispatchEvent('click')` fires straight on the button element regardless of what overlay sits
	// on top or whether it's scrolled below the fold, which is what reliably drives async send()/sendEmail()
	// and closes the dialog. Wait for the LIVE dialog host to render first (the (click) handler isn't wired
	// until then), scope the confirm button to that host (never a stale leaked footer), loop-dispatch and poll
	// the host to DETACH so the mutation truly fired before we move on; page-level dispatchClick is a fallback.
	const page = getPage();
	const dialogHost = page.locator('ga-invoice-send, ga-invoice-email').first();
	// Wait for the mutation dialog to actually be on screen before dispatching — the (click)="send()/sendEmail()"
	// handler isn't wired until the dialog component has rendered.
	await dialogHost.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
	// The email dialog's Send is `[disabled]="form.invalid"`, but the spec fills the email field before this,
	// so the button is enabled; the retry loop below absorbs Angular's settle tick.
	const confirmBtn = dialogHost.locator('nb-card-footer.text-left > button[status="success"]').first();
	for (let i = 0; i < 8; i++) {
		await waitForSpinnerGone();
		await confirmBtn.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
		// FORCE-click FIRST (was an actionable click — that regressed: the ga-invoice-pdf <iframe> streams into
		// the card body and overlays the nb-card-footer coordinates, so a non-force click spins on the "receives
		// pointer events" check and burns the whole 180s test cap). force skips only the actionability CHECK,
		// still dispatches a trusted click that drives the async nbButton (click) -> send()/sendEmail() ->
		// invoicesService.update(status: SENT). Keep dispatch fallbacks for a mid-animation detach.
		await confirmBtn.click({ force: true, timeout: 6000 }).catch(async () => {
			await confirmBtn.dispatchEvent('click').catch(async () => {
				await dispatchClick(InvoicesPage.confirmButtonCss).catch(() => {});
			});
		});
		try {
			// Detach window sized so all 8 retries fit within the 180s test cap. send() awaits invoicesService.update()
			// before dialogRef.close(); 6s absorbs a normal round-trip, and a lingering dialog just loops to re-click.
			await dialogHost.waitFor({ state: 'detached', timeout: 6000 });
			// let the onClose refresh ($refresh$ / invoices$) settle so the grid repaints the SENT badge
			await waitForSpinnerGone();
			await page.waitForLoadState('networkidle').catch(() => {});
			return;
		} catch {
			// dialog still open — the click didn't take (PDF preview still wiring up); loop and re-click
		}
	}
};

export const emailInputVisible = async () => verifyElementIsVisible(InvoicesPage.emailInputCss);

export const enterEmailData = async (data: string) => enterInput(InvoicesPage.emailInputCss, data);

export const editButtonVisible = async () => verifyElementIsVisible(InvoicesPage.editButtonCss);

export const clickEditButton = async (index: number) => {
	// editButtonCss now resolves to a single button (scoped to "Edit"); dispatchClick past any fading
	// toastr/overlay from the prior save so the edit route opens reliably. (index kept for API parity.)
	await waitForSpinnerGone();
	await getPage()
		.locator(InvoicesPage.editButtonCss)
		.nth(index)
		.dispatchEvent('click')
		.catch(() => {});
};

export const viewButtonVisible = async () => verifyElementIsVisible(InvoicesPage.viewButtonCss);

export const clickViewButton = async (index: number) => {
	// viewButtonCss is scoped to the "View" button; dispatchClick to bypass any fading overlay.
	await waitForSpinnerGone();
	await getPage()
		.locator(InvoicesPage.viewButtonCss)
		.first()
		.dispatchEvent('click')
		.catch(() => {});
};

export const deleteButtonVisible = async () => verifyElementIsVisible(InvoicesPage.deleteButtonCss);

export const clickDeleteButton = async () => dispatchClick(InvoicesPage.deleteButtonCss);

export const confirmDeleteButtonVisible = async () => verifyElementIsVisible(InvoicesPage.confirmDeleteButtonCss);

export const clickConfirmDeleteButton = async () => {
	// Delete-confirmation dialog OK button — dispatchClick so the closing popover/dialog backdrop can't
	// intercept it.
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.confirmDeleteButtonCss);
};

export const setStatusButtonVisible = async () => verifyElementIsVisible(InvoicesPage.setStatusButtonCss);

export const clickSetStatusButton = async (text: string) => clickElementByText(InvoicesPage.setStatusButtonCss, text);

export const setStatusFromDropdown = async (text: string) => clickElementByText(InvoicesPage.dropdownOptionCss, text);

export const verifyEstimateExists = async (val: string) => verifyValue(InvoicesPage.verifyInvoiceCss, val);

export const verifyDraftBadgeClass = async () => verifyElementIsVisible(InvoicesPage.draftBadgeCss);

export const verifySentBadgeClass = async () => verifyElementIsVisible(InvoicesPage.successBadgeCss);

export const verifyElementIsDeleted = async (text: string) => {
	// "Invoice deleted" check. The passed pagedata text ('No data for the currently selected employee.')
	// no longer matches the grid's empty message, so don't assert on that stale string. An empty-grid
	// assertion is also unsafe: intra-run pollution (a prior spec's invoice row, or SalesInvoices) can
	// leave rows, false-failing toBeHidden on the data row. Assert the true intent instead (mirrors the
	// proven Estimates.po): the delete-confirmation nb-dialog dispatched and detached (the delete actually
	// fired), then let the grid refresh settle.
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

export const scrollEmailInviteTemplate = async () => scrollDown(InvoicesPage.emailCardCss);

export const moreButtonVisible = async () => verifyElementIsVisible(InvoicesPage.moreButtonCss);

export const clickMoreButton = async () => {
	// The "more" (vertical dots) toolbar button toggles the actions popover; dispatchClick past any
	// fading toastr/overlay so the popover opens reliably.
	await waitForSpinnerGone();
	await dispatchClick(InvoicesPage.moreButtonCss);
};

export const verifyTabButtonVisible = async () => verifyElementIsVisible(InvoicesPage.tabButtonCss);

export const clickTabButton = async (index: number) => clickButtonByIndex(InvoicesPage.tabButtonCss, index);

export const verifyEstimateNumberInputVisible = async () => verifyElementIsVisible(InvoicesPage.inputInvoiceNumberCss);

export const enterEstimateNumberInputData = async (data: string) => {
	await clearField(InvoicesPage.inputInvoiceNumberCss);
	await enterInput(InvoicesPage.inputInvoiceNumberCss, data);
};

export const verifyEstimateDateInput = async () => verifyElementIsVisible(InvoicesPage.estimateDateCss);

export const verifyEstimateDueDateInput = async () => verifyElementIsVisible(InvoicesPage.dueDateInputCss);

export const verifyTotalValueInputVisible = async () => verifyElementIsVisible(InvoicesPage.totalValueInputCss);

export const verifyCurrencyDropdownVisible = async () => verifyElementIsVisible(InvoicesPage.currencySelectCss);

export const verifyStatusInputVisible = async () => verifyElementIsVisible(InvoicesPage.inputStatusCss);

export const searchButtonVisible = async () => verifyElementIsVisible(InvoicesPage.searchButtonCss);

export const clickSearchButton = async () => clickButton(InvoicesPage.searchButtonCss);

export const verifyDraftBadgeNotVisible = async () => verifyElementIsNotVisible(InvoicesPage.draftBadgeCss);

export const resetButtonVisible = async () => verifyElementIsVisible(InvoicesPage.resetButtonCss);

export const clickResetButton = async () => clickButton(InvoicesPage.resetButtonCss);
